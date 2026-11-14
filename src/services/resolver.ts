import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { productionApiBaseUrl, stripTrailingSlash } from '@/config/appConfig';
import { t } from '@/i18n/translations';
import { createExtractorRequiredFormats } from '@/shared/format-presets';
import { isSupportedPublicUrl } from '@/shared/platforms';
import type { ResolveRequest, ResolveResponse, ResolvedMedia } from '@/shared/types';

export async function resolveMedia(request: ResolveRequest) {
  const apiBaseUrl = getApiBaseUrl();
  const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/resolve` : Platform.OS === 'web' ? '/api/resolve' : null;

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      let payload = await response.json() as ResolveResponse;
      if (!payload.ok) {
        throw new ResolveApiError(payload.error);
      }
      if ('pending' in payload && payload.pending) {
        payload = await pollYouTubeJob(endpoint, payload.jobId, request);
      }
      if (!payload.ok) {
        throw new ResolveApiError(payload.error);
      }
      if ('media' in payload) {
        return payload.media;
      }
      throw new ResolveApiError(pendingTimeoutMessage(request.language ?? 'es'));
    } catch (error) {
      if (
        error instanceof ResolveApiError
        || (error instanceof Error && endpoint !== '/api/resolve')
        || !canUseLocalPreviewFallback()
      ) {
        throw error;
      }

      // Local Expo web does not serve Vercel functions; use the same contract-shaped
      // preview so the product flow remains testable before deployment.
    }
  }

  return createLocalPreview(request);
}

async function pollYouTubeJob(endpoint: string, jobId: string, request: ResolveRequest): Promise<ResolveResponse> {
  const maxAttempts = 100;
  const pollIntervalMs = 3_000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await delay(pollIntervalMs);
    const pollUrl = new URL(endpoint, typeof window === 'undefined' ? productionApiBaseUrl : window.location.origin);
    pollUrl.searchParams.set('runId', jobId);
    pollUrl.searchParams.set('url', request.url);
    pollUrl.searchParams.set('language', request.language ?? 'es');

    const response = await fetch(pollUrl.toString(), { cache: 'no-store' });
    const payload = await response.json() as ResolveResponse;
    if (!payload.ok) {
      throw new ResolveApiError(payload.error);
    }
    if (!('pending' in payload) || !payload.pending) {
      return payload;
    }
  }

  throw new ResolveApiError(pendingTimeoutMessage(request.language ?? 'es'));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pendingTimeoutMessage(language: ResolveRequest['language']) {
  return language === 'en'
    ? 'YouTube is still preparing this video. Try resolving it again in a little while.'
    : 'YouTube todavia esta preparando este video. Espera un poco y vuelve a intentarlo.';
}

class ResolveApiError extends Error {}

function canUseLocalPreviewFallback() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return true;
  }

  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

function getApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromExpo = Constants.expoConfig?.extra?.apiBaseUrl;
  const fallback = Platform.OS === 'web' ? '' : productionApiBaseUrl;
  return stripTrailingSlash(String(fromEnv || fromExpo || fallback));
}

function createLocalPreview(request: ResolveRequest): ResolvedMedia {
  const validation = isSupportedPublicUrl(request.url, request.platform);
  if (!validation.ok) {
    throw new Error(t(request.language ?? 'es', validation.error === 'Unsupported platform' ? 'unsupportedPlatform' : 'invalidUrl'));
  }

  return {
    id: `${validation.platform}-${Date.now()}`,
    sourceUrl: validation.normalizedUrl,
    platform: validation.platform,
    title: previewTitle(validation.platform),
    author: t(request.language ?? 'es', 'publicProfile'),
    durationLabel: '00:00',
    notice: t(request.language ?? 'es', 'noDownloadUrl'),
    formats: createExtractorRequiredFormats(request.language ?? 'es'),
    resolvedAt: new Date().toISOString(),
  };
}

function previewTitle(platform: ResolvedMedia['platform']) {
  switch (platform) {
    case 'twitter':
      return 'Twitter public video';
    case 'instagram':
      return 'Instagram public post or reel';
    case 'facebook':
      return 'Facebook public video or reel';
    case 'tiktok':
      return 'TikTok public video';
    case 'youtube':
      return 'YouTube public video or short';
  }
}
