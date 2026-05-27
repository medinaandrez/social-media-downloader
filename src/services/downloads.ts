import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { productionApiBaseUrl, stripTrailingSlash } from '@/config/appConfig';
import { t } from '@/i18n/translations';
import type { DownloadFormat, Language, ResolvedMedia } from '@/shared/types';

type DownloadParams = {
  media: ResolvedMedia;
  format: DownloadFormat;
  mode: 'save' | 'share';
  language: Language;
};

export async function downloadResolvedFormat({ media, format, mode, language }: DownloadParams) {
  if (!format.downloadUrl) {
    throw new Error(t(language, 'noDownloadUrl'));
  }

  if (Platform.OS === 'web') {
    const fileName = fileNameFor(media, format);
    const downloadUrl = webDownloadUrl(format.downloadUrl, fileName, language);
    const shareUrl = absoluteWebUrl(downloadUrl);

    if (mode === 'share' && typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: media.title,
        url: shareUrl,
      });
      return;
    }

    await startBrowserDownload(downloadUrl, fileName, language);
    return;
  }

  const localUri = await downloadToCache(media, format, language);

  if (mode === 'share') {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error(t(language, 'genericError'));
    }
    await Sharing.shareAsync(localUri, {
      mimeType: format.mimeType,
      dialogTitle: media.title,
    });
    return;
  }

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error(t(language, 'genericError'));
  }
  await MediaLibrary.saveToLibraryAsync(localUri);
}

async function downloadToCache(media: ResolvedMedia, format: DownloadFormat, language: Language) {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available.');
  }

  const fileName = fileNameFor(media, format);
  const target = `${FileSystem.cacheDirectory}${fileName}`;
  const result = await FileSystem.downloadAsync(
    nativeDownloadUrl(format.downloadUrl!, fileName, language),
    target,
  );
  if (result.status >= 400) {
    throw new Error(t(language, 'genericError'));
  }
  return result.uri;
}

async function startBrowserDownload(url: string, fileName: string, language: Language) {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await readErrorPayload(response, language);
    throw new Error(payload || `Download failed (${response.status})`);
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_self';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function webDownloadUrl(url: string, fileName: string, language: Language) {
  if (url.startsWith('/api/')) {
    const params = new URLSearchParams({
      filename: fileName,
      language,
    });
    return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
  }

  return proxiedDownloadUrl(url, fileName, language);
}

function absoluteWebUrl(url: string) {
  if (typeof window === 'undefined' || !url.startsWith('/')) {
    return url;
  }

  return `${window.location.origin}${url}`;
}

function nativeDownloadUrl(url: string, fileName: string, language: Language) {
  if (url.startsWith('/')) {
    return `${getApiBaseUrl()}${url}`;
  }

  if (shouldProxyNativeDownload(url)) {
    return `${getApiBaseUrl()}${proxiedDownloadUrl(url, fileName, language)}`;
  }

  return url;
}

function getApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromExpo = Constants.expoConfig?.extra?.apiBaseUrl;
  return stripTrailingSlash(String(fromEnv || fromExpo || productionApiBaseUrl));
}

function proxiedDownloadUrl(url: string, fileName: string, language: Language) {
  const params = new URLSearchParams({
    filename: fileName,
    language,
    url,
  });

  return `/api/download?${params.toString()}`;
}

function shouldProxyNativeDownload(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'googlevideo.com' || hostname.endsWith('.googlevideo.com');
  } catch {
    return false;
  }
}

async function readErrorPayload(response: Response, language: Language) {
  const text = await response.text();

  if (isReplayTimeoutResponse(response.status, text)) {
    return t(language, 'replayTooLarge');
  }

  try {
    const payload = JSON.parse(text) as { error?: string };
    return payload.error;
  } catch {
    return text.trim();
  }
}

function isReplayTimeoutResponse(status: number, text: string) {
  if (status !== 504) {
    return false;
  }

  const normalized = text.toLowerCase();
  return normalized.includes('function_invocation_timeout')
    || normalized.includes('timed out')
    || normalized.includes('tardo demasiado');
}

function fileNameFor(media: ResolvedMedia, format: DownloadFormat) {
  const safeTitle = media.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'download';

  return `${safeTitle}-${format.quality}.${format.extension}`;
}
