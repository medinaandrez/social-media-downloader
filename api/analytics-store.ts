import { list, put } from '@vercel/blob';

import type { AnalyticsEventPayload, AnalyticsRecentError, AnalyticsSummary } from '../src/shared/analytics';
import type { PlatformId } from '../src/shared/types';

type StoredAnalyticsEvent = AnalyticsEventPayload & {
  timestamp: string;
};

const inMemoryEvents: StoredAnalyticsEvent[] = [];

export async function storeAnalyticsEvent(payload: AnalyticsEventPayload) {
  const event: StoredAnalyticsEvent = {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };

  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!hasBlob) {
    inMemoryEvents.push(event);
    console.info('[analytics-event]', JSON.stringify(event));
    return;
  }

  const dateKey = event.timestamp.slice(0, 10);
  const blobPath = `analytics-events/${dateKey}/${event.event}__${event.platform ?? 'unknown'}__${sanitizeSegment(event.errorType ?? 'none')}__${Date.now()}__${Math.random().toString(36).slice(2, 10)}.json`;
  await put(blobPath, JSON.stringify(event), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export async function readAnalyticsSummary(windowHours = 24, platformFilter: PlatformId | 'all' = 'all'): Promise<AnalyticsSummary> {
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const now = Date.now();
  const windowStart = now - (windowHours * 60 * 60 * 1000);
  const counters = {
    byEvent: {} as Record<string, number>,
    byPlatform: {} as Record<string, number>,
    errorsByType: {} as Record<string, number>,
    recentErrors: [] as AnalyticsRecentError[],
    totalEvents: 0,
    lastUpdatedAt: null as string | null,
  };

  if (!hasBlob) {
    for (const event of inMemoryEvents) {
      accumulateFromEvent(counters, event, windowStart, platformFilter);
    }
    counters.recentErrors = counters.recentErrors
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 5);
    return {
      ok: true,
      totalEvents: counters.totalEvents,
      lastUpdatedAt: counters.lastUpdatedAt,
      byEvent: counters.byEvent,
      byPlatform: counters.byPlatform,
      errorsByType: counters.errorsByType,
      recentErrors: counters.recentErrors,
      windowHours,
      storage: 'memory',
    };
  }

  const blobs = await list({ prefix: 'analytics-events/' });
  for (const blob of blobs.blobs) {
    accumulateFromPath(counters, blob.pathname, windowStart, platformFilter);
  }

  counters.recentErrors = counters.recentErrors
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 5);

  return {
    ok: true,
    totalEvents: counters.totalEvents,
    lastUpdatedAt: counters.lastUpdatedAt,
    byEvent: counters.byEvent,
    byPlatform: counters.byPlatform,
    errorsByType: counters.errorsByType,
    recentErrors: counters.recentErrors,
    windowHours,
    storage: 'blob',
  };
}

function accumulateFromEvent(
  counters: {
    byEvent: Record<string, number>;
    byPlatform: Record<string, number>;
    errorsByType: Record<string, number>;
    recentErrors: AnalyticsRecentError[];
    totalEvents: number;
    lastUpdatedAt: string | null;
  },
  event: StoredAnalyticsEvent,
  windowStart: number,
  platformFilter: PlatformId | 'all',
) {
  const eventTs = Date.parse(event.timestamp);
  if (Number.isNaN(eventTs) || eventTs < windowStart) {
    return;
  }

  if (platformFilter !== 'all' && event.platform !== platformFilter) {
    return;
  }

  counters.totalEvents += 1;
  counters.byEvent[event.event] = (counters.byEvent[event.event] ?? 0) + 1;
  if (event.platform) {
    counters.byPlatform[event.platform] = (counters.byPlatform[event.platform] ?? 0) + 1;
  }
  if (event.errorType) {
    counters.errorsByType[event.errorType] = (counters.errorsByType[event.errorType] ?? 0) + 1;
    if (isErrorEvent(event.event)) {
      counters.recentErrors.push({
        event: event.event,
        platform: event.platform ?? 'unknown',
        errorType: event.errorType,
        timestamp: event.timestamp,
      });
    }
  }
  if (!counters.lastUpdatedAt || event.timestamp > counters.lastUpdatedAt) {
    counters.lastUpdatedAt = event.timestamp;
  }
}

function accumulateFromPath(
  counters: {
    byEvent: Record<string, number>;
    byPlatform: Record<string, number>;
    errorsByType: Record<string, number>;
    recentErrors: AnalyticsRecentError[];
    totalEvents: number;
    lastUpdatedAt: string | null;
  },
  pathname: string,
  windowStart: number,
  platformFilter: PlatformId | 'all',
) {
  const parts = pathname.split('/');
  const dateKey = parts[1];
  const fileName = parts.at(-1) ?? '';
  const fileParts = fileName.replace(/\.json$/i, '').split('__');
  const eventName = fileParts[0];
  const platform = fileParts[1];
  const errorType = fileParts.length >= 5 ? fileParts[2] : undefined;
  const timestampStem = fileParts.length >= 5 ? fileParts[3] : fileParts[2];
  if (!eventName || !eventName.includes('_') || !platform || !timestampStem) {
    return;
  }
  const timestampGuess = Number.parseInt(timestampStem ?? '', 10);
  const eventTs = Number.isFinite(timestampGuess) ? timestampGuess : Date.parse(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(eventTs) || eventTs < windowStart) {
    return;
  }

  if (platformFilter !== 'all' && platform !== platformFilter) {
    return;
  }

  counters.totalEvents += 1;
  if (eventName && eventName.includes('_')) {
    counters.byEvent[eventName] = (counters.byEvent[eventName] ?? 0) + 1;
  }
  if (platform) {
    counters.byPlatform[platform] = (counters.byPlatform[platform] ?? 0) + 1;
  }
  if (eventName?.endsWith('_error')) {
    const parsedPlatform = normalizePlatform(platform);
    const parsedErrorType = normalizeErrorTypeSegment(errorType);
    counters.errorsByType[parsedErrorType] = (counters.errorsByType[parsedErrorType] ?? 0) + 1;
    counters.recentErrors.push({
      event: eventName as AnalyticsRecentError['event'],
      platform: parsedPlatform,
      errorType: parsedErrorType,
      timestamp: new Date(eventTs).toISOString(),
    });
  }
  if (!counters.lastUpdatedAt || eventTs > Date.parse(counters.lastUpdatedAt)) {
    counters.lastUpdatedAt = new Date(eventTs).toISOString();
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 48) || 'none';
}

function isErrorEvent(event: string): event is AnalyticsRecentError['event'] {
  return event === 'resolve_error' || event === 'download_error';
}

function normalizePlatform(value: string) {
  if (value === 'twitter' || value === 'instagram' || value === 'facebook' || value === 'tiktok' || value === 'youtube' || value === 'auto' || value === 'unknown') {
    return value;
  }
  return 'unknown';
}

function normalizeErrorTypeSegment(value?: string) {
  if (!value || value === 'none') {
    return 'generic';
  }
  return value;
}
