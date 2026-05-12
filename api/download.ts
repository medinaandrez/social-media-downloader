import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';

const maxDownloadBytes = 90 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const sourceUrl = firstQueryValue(req.query.url);
  const filename = sanitizeFileName(firstQueryValue(req.query.filename) || 'download.mp4');

  if (!sourceUrl || !isAllowedRemoteUrl(sourceUrl)) {
    res.status(400).json({ ok: false, error: 'Invalid download URL.' });
    return;
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 SocialMediaDownloader/1.0',
      },
    });

    if (!upstream.ok) {
      res.status(502).json({ ok: false, error: 'Could not fetch media.' });
      return;
    }

    const contentLength = Number(upstream.headers.get('content-length') ?? 0);
    if (contentLength > maxDownloadBytes) {
      res.status(413).json({ ok: false, error: 'File is too large.' });
      return;
    }

    if (!upstream.body) {
      res.status(502).json({ ok: false, error: 'Could not fetch media.' });
      return;
    }

    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (contentLength > 0) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || contentTypeFor(filename));
    res.status(200);
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch (error) {
    console.error('download proxy failed', error);
    res.status(502).json({ ok: false, error: 'Could not fetch media.' });
  }
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedRemoteUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return hostname !== 'localhost'
      && hostname !== '127.0.0.1'
      && hostname !== '0.0.0.0'
      && !hostname.endsWith('.local');
  } catch {
    return false;
  }
}

function sanitizeFileName(value: string) {
  const sanitized = value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 96);

  return sanitized || 'download.mp4';
}

function contentTypeFor(filename: string) {
  if (filename.endsWith('.m4a')) {
    return 'audio/mp4';
  }

  return 'video/mp4';
}
