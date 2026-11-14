import type { VercelRequest, VercelResponse } from '@vercel/node';

import { storeAnalyticsEvent } from './analytics-store';
import { methodNotAllowed, resolveMediaRequest } from './resolve-core';
import { acquireConcurrency, applyCors, enforceRateLimit } from './security';
import { ApifyYouTubeError, isApifyYouTubeConfigured, readApifyYouTubeJob } from '../src/server/apify-youtube';
import { isSupportedPublicUrl } from '../src/shared/platforms';
import type { Language } from '../src/shared/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method === 'GET') {
    await handleYouTubeJobStatus(req, res);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json(methodNotAllowed());
    return;
  }

  if (!enforceRateLimit(req, res, 'resolve', 12)) {
    return;
  }
  const release = acquireConcurrency(res, 'resolve', 3);
  if (!release) {
    return;
  }

  try {
    const startedAt = Date.now();
    const result = await resolveMediaRequest(req.body);
    if (result.payload.ok && 'pending' in result.payload && result.payload.pending) {
      res.status(result.status).json(result.payload);
      return;
    }
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
      const failure = result.payload as { ok: false; error: string };
      resolveEvent = {
        event: 'resolve_error',
        status: 'error',
        errorType: classifyResolveError(failure.error),
      };
    }

    try {
      await storeAnalyticsEvent({
        event: resolveEvent.event,
        source: 'api',
        platform: parseAnalyticsPlatform(req.body?.platform),
        language: req.body?.language === 'en' ? 'en' : 'es',
        status: resolveEvent.status,
        errorType: resolveEvent.errorType,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error('Failed to store resolve analytics', error);
    }
    res.status(result.status).json(result.payload);
  } finally {
    release();
  }
}

async function handleYouTubeJobStatus(req: VercelRequest, res: VercelResponse) {
  if (!isApifyYouTubeConfigured()) {
    res.status(503).json({ ok: false, error: 'YouTube processing is unavailable.' });
    return;
  }
  if (!enforceRateLimit(req, res, 'youtube-job', 35)) {
    return;
  }
  const release = acquireConcurrency(res, 'youtube-job', 8);
  if (!release) {
    return;
  }

  try {
    const runId = firstQueryValue(req.query.runId);
    const sourceUrl = firstQueryValue(req.query.url);
    const language: Language = firstQueryValue(req.query.language) === 'en' ? 'en' : 'es';
    if (!runId || !sourceUrl) {
      res.status(400).json({ ok: false, error: 'Invalid YouTube job request.' });
      return;
    }
    const validation = isSupportedPublicUrl(sourceUrl, 'youtube');
    if (!validation.ok) {
      res.status(400).json({ ok: false, error: 'Invalid YouTube URL.' });
      return;
    }

    const result = await readApifyYouTubeJob(runId, validation.normalizedUrl, language);
    if (result.status === 'pending') {
      res.status(202).json({ ok: true, pending: true, jobId: runId });
      return;
    }
    if (result.status === 'failed') {
      await trackYouTubeJobResult('resolve_error', language, result.error);
      res.status(result.httpStatus).json({ ok: false, error: result.error });
      return;
    }

    await trackYouTubeJobResult('resolve_success', language);
    res.status(200).json({ ok: true, media: result.media });
  } catch (error) {
    if (error instanceof ApifyYouTubeError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    console.error('YouTube job status lookup failed', error);
    res.status(502).json({ ok: false, error: 'Could not check YouTube processing status.' });
  } finally {
    release();
  }
}

async function trackYouTubeJobResult(event: 'resolve_success' | 'resolve_error', language: Language, message?: string) {
  try {
    await storeAnalyticsEvent({
      event,
      source: 'api',
      platform: 'youtube',
      language,
      status: event === 'resolve_success' ? 'ok' : 'error',
      errorType: message ? classifyJobError(message) : undefined,
    });
  } catch (error) {
    console.error('Failed to store YouTube job analytics', error);
  }
}

function classifyJobError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('limite de gasto') || normalized.includes('spending limit')
    ? 'apify_budget_or_actor_failure'
    : 'youtube_job_failed';
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
