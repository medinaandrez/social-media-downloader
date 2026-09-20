import type { VercelRequest, VercelResponse } from '@vercel/node';

import { storeAnalyticsEvent } from './analytics-store';
import type { AnalyticsEventPayload } from '../src/shared/analytics';
import { applyCors, enforceRateLimit } from './security';

const allowedEvents = new Set(['resolve_start', 'resolve_success', 'resolve_error', 'download_start', 'download_success', 'download_error']);
const allowedPlatforms = new Set(['twitter', 'instagram', 'facebook', 'tiktok', 'youtube', 'auto', 'unknown']);
const allowedKinds = new Set(['video', 'audio']);
const allowedSources = new Set(['web', 'ios', 'android', 'api']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!enforceRateLimit(req, res, 'analytics', 60)) {
    return;
  }

  try {
    const payload = parseAnalyticsEvent(req.body);
    if (!payload) {
      res.status(400).json({ ok: false, error: 'Invalid analytics event' });
      return;
    }

    await storeAnalyticsEvent(payload);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to store analytics event', error);
    res.status(500).json({ ok: false, error: 'Failed to store event' });
  }
}

function parseAnalyticsEvent(value: unknown): AnalyticsEventPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.event !== 'string' || !allowedEvents.has(payload.event)) {
    return null;
  }
  if (payload.platform !== undefined && (typeof payload.platform !== 'string' || !allowedPlatforms.has(payload.platform))) {
    return null;
  }
  if (payload.kind !== undefined && (typeof payload.kind !== 'string' || !allowedKinds.has(payload.kind))) {
    return null;
  }
  if (payload.source !== undefined && (typeof payload.source !== 'string' || !allowedSources.has(payload.source))) {
    return null;
  }

  return {
    event: payload.event as AnalyticsEventPayload['event'],
    platform: payload.platform as AnalyticsEventPayload['platform'],
    kind: payload.kind as AnalyticsEventPayload['kind'],
    language: payload.language === 'en' ? 'en' : 'es',
    source: payload.source as AnalyticsEventPayload['source'],
    status: payload.status === 'error' ? 'error' : payload.status === 'ok' ? 'ok' : undefined,
    errorType: typeof payload.errorType === 'string' ? sanitizeValue(payload.errorType, 48) : undefined,
    durationMs: typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs)
      ? Math.max(0, Math.min(Math.round(payload.durationMs), 10 * 60_000))
      : undefined,
    timestamp: new Date().toISOString(),
  };
}

function sanitizeValue(value: string, maxLength: number) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').slice(0, maxLength) || undefined;
}
