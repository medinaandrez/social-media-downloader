import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createReadStream } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const maxAudioBytes = 80 * 1024 * 1024;
const localBinaryPath = join(process.cwd(), '.bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const sourceUrl = firstQueryValue(req.query.url);
  const filename = sanitizeFileName(firstQueryValue(req.query.filename) || 'twitter-audio.mp4');

  if (!sourceUrl || !isAllowedTwitterUrl(sourceUrl)) {
    res.status(400).json({ ok: false, error: 'Invalid Twitter URL.' });
    return;
  }

  const id = randomUUID();
  const outputPrefix = `smd-audio-${id}`;
  const outputTemplate = join(tmpdir(), `${outputPrefix}.%(ext)s`);

  try {
    await runYtDlp([
      sourceUrl,
      '--format',
      'ba/bestaudio',
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

    const audioPath = await findOutputFile(outputPrefix);
    const audioStat = await stat(audioPath);

    if (audioStat.size > maxAudioBytes) {
      res.status(413).json({ ok: false, error: 'Audio file is too large.' });
      return;
    }

    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', audioStat.size);
    res.setHeader('Content-Type', 'audio/mp4');
    res.status(200);

    createReadStream(audioPath)
      .on('close', () => {
        void cleanupOutput(outputPrefix);
      })
      .pipe(res);
  } catch (error) {
    await cleanupOutput(outputPrefix);
    console.error('audio extraction failed', error);
    res.status(422).json({ ok: false, error: 'Could not extract audio.' });
  }
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
      reject(new Error('Audio extraction timed out.'));
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
    throw new Error('Audio output file was not created.');
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

function isAllowedTwitterUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();

    return url.protocol === 'https:'
      && ['twitter.com', 'x.com', 'mobile.twitter.com'].includes(hostname)
      && /\/status\/\d+/i.test(url.pathname);
  } catch {
    return false;
  }
}

function sanitizeFileName(value: string) {
  const sanitized = value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\.m4a$/i, '.mp4')
    .slice(0, 96);

  return sanitized || 'twitter-audio.mp4';
}
