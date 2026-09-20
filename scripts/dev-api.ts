import { createServer } from 'node:http';

import { methodNotAllowed, resolveMediaRequest } from '../api/resolve-core';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const maxBodyBytes = 16 * 1024;

const server = createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url !== '/api/resolve') {
    writeJson(res, 404, { ok: false, error: 'Not found' });
    return;
  }

  if (req.method !== 'POST') {
    writeJson(res, 405, methodNotAllowed());
    return;
  }

  try {
    const body = await readJson(req);
    const result = await resolveMediaRequest(body);
    writeJson(res, result.status, result.payload);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 500;
    const message = error instanceof RequestBodyError ? error.message : 'Unexpected server error';
    writeJson(res, status, { ok: false, error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Local API listening on http://${host}:${port}`);
});

function setCorsHeaders(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
    } catch {
      // Invalid origins do not receive CORS permission.
    }
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function writeJson(res: import('node:http').ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
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

class RequestBodyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
