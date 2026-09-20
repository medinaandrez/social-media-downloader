import type { VercelRequest, VercelResponse } from '@vercel/node';

import { readAnalyticsSummary } from './analytics-store';
import type { PlatformId } from '../src/shared/types';
import { applyCors, enforceRateLimit, safeTokenEquals } from './security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, OPTIONS', 'Content-Type, X-Admin-Token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!enforceRateLimit(req, res, 'analytics-summary', 20)) {
    return;
  }

  try {
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const rawHours = Number.parseInt(String(req.query.hours ?? '24'), 10);
    const hours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 1), 24 * 30) : 24;
    const platform = parsePlatformFilter(req.query.platform);
    const summary = await readAnalyticsSummary(hours, platform);
    res.status(200).json(summary);
  } catch (error) {
    console.error('Failed to read analytics summary', error);
    res.status(500).json({ ok: false, error: 'Failed to read summary' });
  }
}

function isAuthorized(req: VercelRequest) {
  const expectedToken = process.env.ADMIN_METRICS_TOKEN?.trim();
  if (!expectedToken) {
    return process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
  }

  const headerToken = getHeaderValue(req.headers['x-admin-token']);
  return headerToken.length > 0 && safeTokenEquals(headerToken, expectedToken);
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

function parsePlatformFilter(value: unknown): PlatformId | 'all' {
  if (value === 'twitter' || value === 'instagram' || value === 'facebook' || value === 'tiktok' || value === 'youtube') {
    return value;
  }

  return 'all';
}
