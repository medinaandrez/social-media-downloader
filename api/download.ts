import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';

const maxDownloadBytes = 90 * 1024 * 1024;
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

  const sourceUrl = firstQueryValue(req.query.url);
  const filename = sanitizeFileName(firstQueryValue(req.query.filename) || 'download.mp4');
  const language = firstQueryValue(req.query.language) === 'en' ? 'en' : 'es';

  if (!sourceUrl || !isAllowedRemoteUrl(sourceUrl)) {
    res.status(400).json({ ok: false, error: messages[language].invalidUrl });
    return;
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 SocialMediaDownloader/1.0',
      },
    });

    if (!upstream.ok) {
      res.status(502).json({ ok: false, error: messages[language].fetchFailed });
      return;
    }

    const contentLength = Number(upstream.headers.get('content-length') ?? 0);
    if (contentLength > maxDownloadBytes) {
      res.status(413).json({ ok: false, error: messages[language].tooLarge });
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
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch (error) {
    console.error('download proxy failed', error);
    res.status(502).json({ ok: false, error: messages[language].fetchFailed });
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
