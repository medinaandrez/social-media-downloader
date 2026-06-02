import type { VercelRequest, VercelResponse } from '@vercel/node';

import { readAnalyticsSummary } from './analytics-store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const rawHours = Number.parseInt(String(req.query.hours ?? '24'), 10);
    const hours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 1), 24 * 30) : 24;
    const summary = await readAnalyticsSummary(hours);
    res.status(200).json(summary);
  } catch (error) {
    console.error('Failed to read analytics summary', error);
    res.status(500).json({ ok: false, error: 'Failed to read summary' });
  }
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function isAuthorized(req: VercelRequest) {
  const expectedToken = process.env.ADMIN_METRICS_TOKEN?.trim();
  if (!expectedToken) {
    return isLocalRequest(req);
  }

  const headerToken = getHeaderValue(req.headers['x-admin-token']);
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const provided = headerToken || queryToken;
  return provided.length > 0 && safeEquals(provided, expectedToken);
}

function isLocalRequest(req: VercelRequest) {
  const host = getHeaderValue(req.headers.host);
  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
}

function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }
  return '';
}

function safeEquals(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
