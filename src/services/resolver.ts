import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { t } from '@/i18n/translations';
import { isSupportedPublicUrl } from '@/shared/platforms';
import type { DownloadFormat, ResolveRequest, ResolveResponse, ResolvedMedia } from '@/shared/types';

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
      const payload = await response.json() as ResolveResponse;
      if (!payload.ok) {
        throw new ResolveApiError(payload.error);
      }
      return payload.media;
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
  return String(fromEnv || fromExpo || '').replace(/\/$/, '');
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
    formats: createPendingFormats(),
    resolvedAt: new Date().toISOString(),
  };
}

function createPendingFormats(): DownloadFormat[] {
  return [
    ['video-high', 'video', 'high', 'MP4 HD', 'mp4', 'video/mp4'],
    ['video-medium', 'video', 'medium', 'MP4', 'mp4', 'video/mp4'],
    ['video-low', 'video', 'low', 'MP4 ligero', 'mp4', 'video/mp4'],
    ['audio-high', 'audio', 'high', 'Audio HQ', 'm4a', 'audio/mp4'],
    ['audio-medium', 'audio', 'medium', 'Audio', 'm4a', 'audio/mp4'],
    ['audio-low', 'audio', 'low', 'Audio ligero', 'm4a', 'audio/mp4'],
  ].map(([id, kind, quality, label, extension, mimeType]) => ({
    id,
    kind: kind as DownloadFormat['kind'],
    quality: quality as DownloadFormat['quality'],
    label,
    extension,
    mimeType,
    status: 'extractor_required',
  }));
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
  }
}
