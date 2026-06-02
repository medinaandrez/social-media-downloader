import type { Language, MediaKind, PlatformId } from './types';

export type AnalyticsEventName =
  | 'resolve_start'
  | 'resolve_success'
  | 'resolve_error'
  | 'download_start'
  | 'download_success'
  | 'download_error';

export type AnalyticsEventPayload = {
  event: AnalyticsEventName;
  platform?: PlatformId | 'auto' | 'unknown';
  kind?: MediaKind;
  language?: Language;
  source?: 'web' | 'ios' | 'android' | 'api';
  status?: 'ok' | 'error';
  errorType?: string;
  durationMs?: number;
  timestamp?: string;
};

export type AnalyticsSummary = {
  ok: boolean;
  totalEvents: number;
  lastUpdatedAt: string | null;
  byEvent: Record<string, number>;
  byPlatform: Record<string, number>;
  errorsByType: Record<string, number>;
  windowHours: number;
  storage: 'blob' | 'memory';
};
