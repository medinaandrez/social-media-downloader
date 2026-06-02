import { Platform } from 'react-native';

import { productionApiBaseUrl, stripTrailingSlash } from '@/config/appConfig';
import type { AnalyticsEventPayload } from '@/shared/analytics';

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

function getAnalyticsEndpoint() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const base = stripTrailingSlash(String(fromEnv || productionApiBaseUrl));

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname !== 'socialm-downloader.vercel.app') {
    return `${base}/api/analytics`;
  }

  return `${base}/api/analytics`;
}

function currentSource() {
  if (Platform.OS === 'web') {
    return 'web';
  }
  if (Platform.OS === 'ios') {
    return 'ios';
  }
  return 'android';
}
