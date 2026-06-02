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
  const blobPath = `analytics-events/${dateKey}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.json`;
  await put(blobPath, JSON.stringify(event), {
    access: 'public',
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
      accumulate(counters, event, windowStart);
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
    const response = await fetch(blob.url);
    if (!response.ok) {
      continue;
    }
    try {
      const event = await response.json() as StoredAnalyticsEvent;
      accumulate(counters, event, windowStart);
    } catch {
      // Ignore malformed analytics events.
    }
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

function accumulate(
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
