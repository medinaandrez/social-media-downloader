import { list, put } from '@vercel/blob';

import type { AnalyticsEventPayload, AnalyticsSummary } from '../src/shared/analytics';

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
  const blobPath = `analytics-events/${dateKey}/${event.event}__${event.platform ?? 'unknown'}__${Date.now()}__${Math.random().toString(36).slice(2, 10)}.json`;
  await put(blobPath, JSON.stringify(event), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export async function readAnalyticsSummary(windowHours = 24): Promise<AnalyticsSummary> {
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const now = Date.now();
  const windowStart = now - (windowHours * 60 * 60 * 1000);
  const counters = {
    byEvent: {} as Record<string, number>,
    byPlatform: {} as Record<string, number>,
    errorsByType: {} as Record<string, number>,
    totalEvents: 0,
    lastUpdatedAt: null as string | null,
  };

  if (!hasBlob) {
    for (const event of inMemoryEvents) {
      accumulateFromEvent(counters, event, windowStart);
    }
    return {
      ok: true,
      totalEvents: counters.totalEvents,
      lastUpdatedAt: counters.lastUpdatedAt,
      byEvent: counters.byEvent,
      byPlatform: counters.byPlatform,
      errorsByType: counters.errorsByType,
      windowHours,
      storage: 'memory',
    };
  }

  const blobs = await list({ prefix: 'analytics-events/' });
  for (const blob of blobs.blobs) {
    accumulateFromPath(counters, blob.pathname, windowStart);
  }

  return {
    ok: true,
    totalEvents: counters.totalEvents,
    lastUpdatedAt: counters.lastUpdatedAt,
    byEvent: counters.byEvent,
    byPlatform: counters.byPlatform,
    errorsByType: counters.errorsByType,
    windowHours,
    storage: 'blob',
  };
}

function accumulateFromEvent(
  counters: {
    byEvent: Record<string, number>;
    byPlatform: Record<string, number>;
    errorsByType: Record<string, number>;
    totalEvents: number;
    lastUpdatedAt: string | null;
  },
  event: StoredAnalyticsEvent,
  windowStart: number,
) {
  const eventTs = Date.parse(event.timestamp);
  if (Number.isNaN(eventTs) || eventTs < windowStart) {
    return;
  }

  counters.totalEvents += 1;
  counters.byEvent[event.event] = (counters.byEvent[event.event] ?? 0) + 1;
  if (event.platform) {
    counters.byPlatform[event.platform] = (counters.byPlatform[event.platform] ?? 0) + 1;
  }
  if (event.errorType) {
    counters.errorsByType[event.errorType] = (counters.errorsByType[event.errorType] ?? 0) + 1;
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
    totalEvents: number;
    lastUpdatedAt: string | null;
  },
  pathname: string,
  windowStart: number,
) {
  const parts = pathname.split('/');
  const dateKey = parts[1];
  const fileName = parts.at(-1) ?? '';
  const [eventName, platform, timestampStem] = fileName.replace(/\.json$/i, '').split('__');
  if (!eventName || !eventName.includes('_') || !platform || !timestampStem) {
    return;
  }
  const timestampGuess = Number.parseInt(timestampStem ?? '', 10);
  const eventTs = Number.isFinite(timestampGuess) ? timestampGuess : Date.parse(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(eventTs) || eventTs < windowStart) {
    return;
  }

  counters.totalEvents += 1;
  if (eventName && eventName.includes('_')) {
    counters.byEvent[eventName] = (counters.byEvent[eventName] ?? 0) + 1;
  }
  if (platform) {
    counters.byPlatform[platform] = (counters.byPlatform[platform] ?? 0) + 1;
  }
  if (!counters.lastUpdatedAt || eventTs > Date.parse(counters.lastUpdatedAt)) {
    counters.lastUpdatedAt = new Date(eventTs).toISOString();
  }
}
