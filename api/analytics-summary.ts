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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');
}
