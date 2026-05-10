import type { VercelRequest, VercelResponse } from '@vercel/node';

import { methodNotAllowed, resolveMediaRequest } from './resolve-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json(methodNotAllowed());
    return;
  }

  const result = await resolveMediaRequest(req.body);
  res.status(result.status).json(result.payload);
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');
}
