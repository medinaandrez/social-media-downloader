import { createServer } from 'node:http';

import { methodNotAllowed, resolveMediaRequest } from '../api/resolve-core';

const port = Number(process.env.PORT || 3200);
const authToken = process.env.YOUTUBE_RESOLVE_SERVICE_TOKEN?.trim() || null;

const server = createServer(async (req, res) => {
  setCorsHeaders(res);

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

  if (authToken && req.headers.authorization !== `Bearer ${authToken}`) {
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
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    writeJson(res, 500, { ok: false, error: message });
  }
});

server.listen(port, () => {
  console.log(`YouTube resolve service listening on http://localhost:${port}`);
});

function setCorsHeaders(res: Parameters<typeof writeJson>[0]) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function writeJson(res: import('node:http').ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readJson(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}
