import type { VercelRequest, VercelResponse } from '@vercel/node';

import { storeAnalyticsEvent } from './analytics-store';
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

  const startedAt = Date.now();
  const result = await resolveMediaRequest(req.body);
  let resolveEvent: {
    event: 'resolve_success' | 'resolve_error';
    status: 'ok' | 'error';
    errorType?: string;
  };
  if (result.payload.ok) {
    resolveEvent = {
      event: 'resolve_success',
      status: 'ok',
      errorType: undefined,
    };
  } else {
    resolveEvent = {
      event: 'resolve_error',
      status: 'error',
      errorType: classifyResolveError(result.payload.error),
    };
  }

  await storeAnalyticsEvent({
    event: resolveEvent.event,
    source: 'api',
    platform: parseAnalyticsPlatform(req.body?.platform),
    language: req.body?.language === 'en' ? 'en' : 'es',
    status: resolveEvent.status,
    errorType: resolveEvent.errorType,
    durationMs: Date.now() - startedAt,
  });
  res.status(result.status).json(result.payload);
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function classifyResolveError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('anti-bot') || normalized.includes('not a bot')) {
    return 'youtube_antibot';
  }
  if (normalized.includes('tardo demasiado') || normalized.includes('timeout')) {
    return 'timeout';
  }
  if (normalized.includes('iniciar sesion') || normalized.includes('signing in') || normalized.includes('login')) {
    return 'login_required';
  }
  return 'generic';
}

function parseAnalyticsPlatform(platform: unknown) {
  if (platform === 'twitter' || platform === 'instagram' || platform === 'facebook' || platform === 'tiktok' || platform === 'youtube') {
    return platform;
  }
  if (platform === 'auto') {
    return 'auto';
  }
  return 'unknown';
}
