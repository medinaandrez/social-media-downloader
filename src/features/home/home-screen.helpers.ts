import { Platform } from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';

import { t } from '@/i18n/translations';
import { platforms } from '@/shared/platforms';
import type { DownloadFormat, Language, MediaKind, PlatformId, ResolvedMedia } from '@/shared/types';

export const mediaKinds: MediaKind[] = ['video', 'audio'];

export type ActionPhase = 'idle' | 'preparing' | 'audio';

export function pickPreferredDownloadableFormat(formats: DownloadFormat[], kind: MediaKind) {
  return formats.find((format) => format.kind === kind && isDownloadableFormat(format))
    ?? firstDownloadableFormat(formats);
}

export function firstDownloadableFormat(formats: DownloadFormat[]) {
  return formats.find(isDownloadableFormat);
}

export function hasDownloadableFormat(formats: DownloadFormat[], kind: MediaKind) {
  return formats.some((format) => format.kind === kind && isDownloadableFormat(format));
}

export function isDownloadableFormat(format: DownloadFormat) {
  return format.status === 'ready' && Boolean(format.downloadUrl);
}

export function platformLabel(platform: PlatformId) {
  return platforms.find((item) => item.id === platform)?.label ?? platform;
}

export function isGeneratedAudio(media: ResolvedMedia, format: DownloadFormat) {
  return media.platform === 'twitter' && format.kind === 'audio' && format.downloadUrl?.startsWith('/api/audio');
}

export function doneMessageFor(mode: 'save' | 'share', language: Language) {
  if (Platform.OS === 'web' && mode === 'save') {
    return t(language, 'webDownloadStarted');
  }

  return t(language, mode === 'save' ? 'savedBody' : 'sharedBody');
}

export async function readClipboardText() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  return ExpoClipboard.getStringAsync();
}

export async function writeClipboardText(value: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  await ExpoClipboard.setStringAsync(value);
}
