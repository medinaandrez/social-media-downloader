import type { VercelRequest, VercelResponse } from '@vercel/node';

import { storeAnalyticsEvent } from './analytics-store';
import type { AnalyticsEventPayload } from '../src/shared/analytics';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const payload = (req.body ?? {}) as AnalyticsEventPayload;
    if (!payload.event || typeof payload.event !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing event name' });
      return;
    }

    await storeAnalyticsEvent(payload);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to store analytics event', error);
    res.status(500).json({ ok: false, error: 'Failed to store event' });
  }
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');
}
