import { timingSafeEqual } from 'node:crypto';

import type { VercelRequest, VercelResponse } from '@vercel/node';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();
const activeRequests = new Map<string, number>();
const productionOrigin = 'https://socialm-downloader.vercel.app';

export function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  methods: string,
  headers = 'Content-Type',
) {
  const origin = firstHeader(req.headers.origin);
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', headers);
  res.setHeader('Access-Control-Allow-Methods', methods);
}

export function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  scope: string,
  limit: number,
  windowMs = 60_000,
) {
  const now = Date.now();
  const key = `${scope}:${clientIdentifier(req)}`;
  const current = rateLimitEntries.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + windowMs }
    : { count: current.count + 1, resetAt: current.resetAt };

  rateLimitEntries.set(key, entry);
  pruneRateLimitEntries(now);

  const remaining = Math.max(0, limit - entry.count);
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count <= limit) {
    return true;
  }

  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
  res.status(429).json({ ok: false, error: 'Too many requests. Try again later.' });
  return false;
}

export function safeTokenEquals(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function acquireConcurrency(res: VercelResponse, scope: string, limit: number) {
  const active = activeRequests.get(scope) ?? 0;
  if (active >= limit) {
    res.setHeader('Retry-After', '5');
    res.status(503).json({ ok: false, error: 'Service is busy. Try again shortly.' });
    return null;
  }

  activeRequests.set(scope, active + 1);
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const next = Math.max(0, (activeRequests.get(scope) ?? 1) - 1);
    if (next === 0) {
      activeRequests.delete(scope);
    } else {
      activeRequests.set(scope, next);
    }
  };
}

function clientIdentifier(req: VercelRequest) {
  const forwarded = firstHeader(req.headers['x-forwarded-for']);
  const realIp = firstHeader(req.headers['x-real-ip']);
  const candidate = forwarded.split(',')[0]?.trim() || realIp || req.socket?.remoteAddress || 'unknown';
  return candidate.replace(/[^a-f0-9:.]/gi, '').slice(0, 64) || 'unknown';
}

function firstHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }
  return value?.trim() ?? '';
}

function isAllowedOrigin(origin: string) {
  if (origin === productionOrigin) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function pruneRateLimitEntries(now: number) {
  if (rateLimitEntries.size < 2_000) {
    return;
  }

  for (const [key, entry] of rateLimitEntries) {
    if (entry.resetAt <= now) {
      rateLimitEntries.delete(key);
    }
  }

  while (rateLimitEntries.size > 2_000) {
    const oldestKey = rateLimitEntries.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    rateLimitEntries.delete(oldestKey);
  }
}
