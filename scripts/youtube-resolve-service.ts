import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

import { methodNotAllowed, resolveMediaRequest } from '../api/resolve-core';

const port = Number(process.env.PORT || 3200);
const authToken = process.env.YOUTUBE_RESOLVE_SERVICE_TOKEN?.trim() || null;
const maxBodyBytes = 16 * 1024;

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/healthz' || req.url === '/health') {
    writeJson(res, 200, { ok: true, service: 'youtube-resolve', status: 'healthy' });
    return;
  }

  if (req.url !== '/api/resolve') {
    writeJson(res, 404, { ok: false, error: 'Not found' });
    return;
  }

  if (!authToken) {
    writeJson(res, 503, { ok: false, error: 'Service authentication is not configured' });
    return;
  }

  const providedToken = readBearerToken(req.headers.authorization);
  if (!providedToken || !safeTokenEquals(providedToken, authToken)) {
    writeJson(res, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'POST') {
    writeJson(res, 405, methodNotAllowed());
    return;
  }

  try {
    const body = await readJson(req);
    const result = await resolveMediaRequest(body, { allowDedicatedYouTubeService: false });
    writeJson(res, result.status, result.payload);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 500;
    const message = error instanceof RequestBodyError ? error.message : 'Unexpected server error';
    writeJson(res, status, { ok: false, error: message });
  }
});

server.listen(port, () => {
  console.log(`YouTube resolve service listening on http://localhost:${port}`);
});

function writeJson(res: import('node:http').ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBodyBytes) {
      throw new RequestBodyError(413, 'Request body is too large');
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new RequestBodyError(400, 'Invalid JSON body');
  }
}

function readBearerToken(value: string | undefined) {
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : '';
}

function safeTokenEquals(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

class RequestBodyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
