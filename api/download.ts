import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { acquireConcurrency, enforceRateLimit } from './security';

const maxDownloadBytes = readMaxDownloadBytes();
const downloadTimeoutMs = 45_000;
const maxRedirects = 3;
const allowedRemoteHosts = [
  /^video\.twimg\.com$/i,
  /^pbs\.twimg\.com$/i,
  /(^|\.)tiktokcdn\.com$/i,
  /(^|\.)tiktokcdn-us\.com$/i,
  /(^|\.)byteoversea\.com$/i,
  /(^|\.)muscdn\.com$/i,
  /(^|\.)akamaized\.net$/i,
  /(^|\.)googlevideo\.com$/i,
];
const messages = {
  es: {
    invalidUrl: 'La URL de descarga no es valida.',
    fetchFailed: 'No se pudo descargar el archivo desde la plataforma. Intenta de nuevo.',
    tooLarge: 'El archivo es demasiado grande para descargarlo desde esta version.',
  },
  en: {
    invalidUrl: 'The download URL is not valid.',
    fetchFailed: 'Could not download the file from the platform. Try again.',
    tooLarge: 'The file is too large to download from this version.',
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  if (!enforceRateLimit(req, res, 'download', 20)) {
    return;
  }
  const sourceUrl = firstQueryValue(req.query.url);
  const filename = sanitizeFileName(firstQueryValue(req.query.filename) || 'download.mp4');
  const language = firstQueryValue(req.query.language) === 'en' ? 'en' : 'es';

  if (!sourceUrl || !isAllowedRemoteUrl(sourceUrl)) {
    res.status(400).json({ ok: false, error: messages[language].invalidUrl });
    return;
  }

  const release = acquireConcurrency(res, 'download', 4);
  if (!release) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);
  try {
    const upstream = await fetchAllowedRemoteUrl(sourceUrl, controller.signal);

    if (!upstream.ok) {
      res.status(502).json({ ok: false, error: messages[language].fetchFailed });
      return;
    }

    const contentLength = Number(upstream.headers.get('content-length') ?? 0);
    if (contentLength > maxDownloadBytes) {
      res.status(413).json({ ok: false, error: messages[language].tooLarge });
      await upstream.body?.cancel();
      return;
    }

    if (!upstream.body) {
      res.status(502).json({ ok: false, error: messages[language].fetchFailed });
      return;
    }

    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (contentLength > 0) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || contentTypeFor(filename));
    res.status(200);
    await pipeline(
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),
      createByteLimitStream(maxDownloadBytes),
      res,
    );
  } catch (error) {
    console.error('download proxy failed', error);
    if (!res.headersSent) {
      const tooLarge = error instanceof Error && error.message === 'DOWNLOAD_SIZE_LIMIT';
      res.status(tooLarge ? 413 : 502).json({
        ok: false,
        error: tooLarge ? messages[language].tooLarge : messages[language].fetchFailed,
      });
    } else {
      res.destroy();
    }
  } finally {
    clearTimeout(timeout);
    release();
  }
}

async function fetchAllowedRemoteUrl(initialUrl: string, signal: AbortSignal) {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (!isAllowedRemoteUrl(currentUrl)) {
      throw new Error('DISALLOWED_DOWNLOAD_URL');
    }

    const response = await fetch(currentUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 SocialMediaDownloader/1.0' },
      redirect: 'manual',
      signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirectCount === maxRedirects) {
      throw new Error('INVALID_DOWNLOAD_REDIRECT');
    }
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error('TOO_MANY_DOWNLOAD_REDIRECTS');
}

function createByteLimitStream(maxBytes: number) {
  let receivedBytes = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      receivedBytes += Buffer.byteLength(chunk);
      if (receivedBytes > maxBytes) {
        callback(new Error('DOWNLOAD_SIZE_LIMIT'));
        return;
      }
      callback(null, chunk);
    },
  });
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
    const isSafeRemoteHost = hostname !== 'localhost'
      && hostname !== '127.0.0.1'
      && hostname !== '0.0.0.0'
      && !hostname.endsWith('.local');

    return isSafeRemoteHost && allowedRemoteHosts.some((pattern) => pattern.test(hostname));
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

function readMaxDownloadBytes() {
  const configured = Number(process.env.MAX_DOWNLOAD_BYTES);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return 180 * 1024 * 1024;
}
