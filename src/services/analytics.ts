import { productionApiBaseUrl, stripTrailingSlash } from '@/config/appConfig';
import type { AnalyticsEventPayload, AnalyticsSummary } from '@/shared/analytics';

export async function trackAnalyticsEvent(payload: AnalyticsEventPayload) {
  try {
    const endpoint = getAnalyticsEndpoint();
    if (!endpoint) {
      return;
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        source: payload.source ?? currentSource(),
        timestamp: payload.timestamp ?? new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics must never block primary product flows.
  }
}

export async function fetchAnalyticsSummary(hours = 24) {
  return fetchAnalyticsSummaryWithToken(hours);
}

export async function fetchAnalyticsSummaryWithToken(hours = 24, token?: string) {
  const endpoint = getAnalyticsSummaryEndpoint(hours);
  if (!endpoint) {
    throw new Error('Analytics endpoint is not available.');
  }

  const response = await fetch(endpoint, token ? {
    headers: {
      'X-Admin-Token': token,
    },
  } : undefined);
  if (!response.ok) {
    throw new Error(`Analytics summary request failed (${response.status})`);
  }

  return response.json() as Promise<AnalyticsSummary>;
}

function getAnalyticsEndpoint() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const base = stripTrailingSlash(String(fromEnv || productionApiBaseUrl));
  return `${base}/api/analytics`;
}

function getAnalyticsSummaryEndpoint(hours: number) {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const base = stripTrailingSlash(String(fromEnv || productionApiBaseUrl));
  return `${base}/api/analytics-summary?hours=${hours}`;
}

function currentSource() {
  if (typeof window !== 'undefined') {
    return 'web';
  }
  return 'android';
}
