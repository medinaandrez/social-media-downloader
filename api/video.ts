import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createReadStream, existsSync } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const maxVideoBytes = 90 * 1024 * 1024;
const localBinaryPath = join(process.cwd(), '.bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const sourceUrl = firstQueryValue(req.query.url);
  const quality = firstQueryValue(req.query.quality) === 'low' ? 'low' : 'high';
  const filename = sanitizeFileName(firstQueryValue(req.query.filename) || `instagram-video-${quality}.mp4`);

  if (!sourceUrl || !isAllowedInstagramUrl(sourceUrl)) {
    res.status(400).json({ ok: false, error: 'Invalid Instagram URL.' });
    return;
  }

  const id = randomUUID();
  const outputPrefix = `smd-video-${id}`;
  const outputTemplate = join(tmpdir(), `${outputPrefix}.%(ext)s`);

  try {
    await runYtDlp([
      sourceUrl,
      '--format',
      formatSelectorFor(quality),
      '--force-ipv4',
      '--no-playlist',
      '--no-warnings',
      '--retries',
      '1',
      '--quiet',
      '--socket-timeout',
      '15',
      '--output',
      outputTemplate,
    ]);

    const videoPath = await findOutputFile(outputPrefix);
    const videoStat = await stat(videoPath);

    if (videoStat.size > maxVideoBytes) {
      res.status(413).json({ ok: false, error: 'Video file is too large.' });
      return;
    }

    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', videoStat.size);
    res.setHeader('Content-Type', 'video/mp4');
    res.status(200);

    createReadStream(videoPath)
      .on('close', () => {
        void cleanupOutput(outputPrefix);
      })
      .pipe(res);
  } catch (error) {
    await cleanupOutput(outputPrefix);
    console.error('video extraction failed', error);
    res.status(422).json({ ok: false, error: 'Could not prepare video.' });
  }
}

function formatSelectorFor(quality: 'high' | 'low') {
  if (quality === 'low') {
    return 'worst[ext=mp4]/worst';
  }

  return 'best[ext=mp4]/best';
}

function runYtDlp(args: string[]) {
  const binary = process.env.YTDLP_PATH || (existsSync(localBinaryPath) ? localBinaryPath : 'yt-dlp');

  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Video extraction timed out.'));
    }, 55000);

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

async function findOutputFile(outputPrefix: string) {
  const files = await readdir(tmpdir());
  const file = files.find((item) => (
    item.startsWith(outputPrefix)
    && !item.endsWith('.part')
    && !item.endsWith('.ytdl')
  ));

  if (!file) {
    throw new Error('Video output file was not created.');
  }

  return join(tmpdir(), file);
}

async function cleanupOutput(outputPrefix: string) {
  const files = await readdir(tmpdir());
  await Promise.all(files
    .filter((item) => item.startsWith(outputPrefix))
    .map((item) => rm(join(tmpdir(), item), { force: true })));
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedInstagramUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();

    return url.protocol === 'https:'
      && hostname === 'instagram.com'
      && (/\/p\//i.test(url.pathname) || /\/reel\//i.test(url.pathname));
  } catch {
    return false;
  }
}

function sanitizeFileName(value: string) {
  const sanitized = value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\.(?!mp4$)[^.]+$/i, '.mp4')
    .slice(0, 96);

  return sanitized.endsWith('.mp4') ? sanitized : `${sanitized || 'instagram-video'}.mp4`;
}
