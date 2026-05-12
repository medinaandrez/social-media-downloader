import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

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
    const downloadUrl = proxiedDownloadUrl(format.downloadUrl, fileName);

    if (mode === 'share' && typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: media.title,
        url: downloadUrl,
      });
      return;
    }

    startBrowserDownload(downloadUrl, fileName);
    return;
  }

  const localUri = await downloadToCache(media, format);

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

async function downloadToCache(media: ResolvedMedia, format: DownloadFormat) {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available.');
  }

  const target = `${FileSystem.cacheDirectory}${fileNameFor(media, format)}`;
  const result = await FileSystem.downloadAsync(format.downloadUrl!, target);
  return result.uri;
}

function startBrowserDownload(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_self';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function proxiedDownloadUrl(url: string, fileName: string) {
  const params = new URLSearchParams({
    filename: fileName,
    url,
  });

  return `/api/download?${params.toString()}`;
}

function fileNameFor(media: ResolvedMedia, format: DownloadFormat) {
  const safeTitle = media.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'download';

  return `${safeTitle}-${format.quality}.${format.extension}`;
}
