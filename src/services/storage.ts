import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { historyLimit } from '@/config/appConfig';
import type { FailureReport, HistoryItem, Language, ThemePreference } from '@/shared/types';

const HISTORY_KEY = 'smd:history';
const LANGUAGE_KEY = 'smd:language';
const FAILURE_REPORTS_KEY = 'smd:failure-reports';
const THEME_PREFERENCE_KEY = 'smd:theme-preference';
const ADMIN_METRICS_TOKEN_KEY = 'smd:admin-metrics-token';
const SECURE_ADMIN_METRICS_TOKEN_KEY = 'smd.admin-metrics-token';

export async function loadHistory() {
  const value = await AsyncStorage.getItem(HISTORY_KEY);
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown[];
    return parsed.map(normalizeHistoryItem).filter((item): item is HistoryItem => Boolean(item));
  } catch {
    return [];
  }
}

export async function saveHistory(items: HistoryItem[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, historyLimit)));
}

export async function loadFailureReports() {
  const value = await AsyncStorage.getItem(FAILURE_REPORTS_KEY);
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as FailureReport[];
  } catch {
    return [];
  }
}

export async function saveFailureReports(items: FailureReport[]) {
  await AsyncStorage.setItem(FAILURE_REPORTS_KEY, JSON.stringify(items.slice(0, historyLimit)));
}

export async function loadLanguage() {
  const value = await AsyncStorage.getItem(LANGUAGE_KEY);
  return value === 'en' || value === 'es' ? value : 'es';
}

export async function saveLanguage(language: Language) {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}

export async function loadThemePreference() {
  const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export async function saveThemePreference(themePreference: ThemePreference) {
  await AsyncStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
}

export async function loadAdminMetricsToken() {
  if (Platform.OS === 'web') {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SECURE_ADMIN_METRICS_TOKEN_KEY);
  }

  const secureToken = await SecureStore.getItemAsync(SECURE_ADMIN_METRICS_TOKEN_KEY);
  if (secureToken) {
    return secureToken;
  }

  const legacyToken = await AsyncStorage.getItem(ADMIN_METRICS_TOKEN_KEY);
  if (legacyToken) {
    await saveAdminMetricsToken(legacyToken);
    await AsyncStorage.removeItem(ADMIN_METRICS_TOKEN_KEY);
  }
  return legacyToken;
}

export async function saveAdminMetricsToken(token: string) {
  const normalized = token.trim();
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SECURE_ADMIN_METRICS_TOKEN_KEY, normalized);
    }
    return;
  }

  await SecureStore.setItemAsync(SECURE_ADMIN_METRICS_TOKEN_KEY, normalized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearAdminMetricsToken() {
  await AsyncStorage.removeItem(ADMIN_METRICS_TOKEN_KEY);
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SECURE_ADMIN_METRICS_TOKEN_KEY);
    }
    return;
  }
  await SecureStore.deleteItemAsync(SECURE_ADMIN_METRICS_TOKEN_KEY);
}

function normalizeHistoryItem(item: unknown): HistoryItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const candidate = item as Partial<HistoryItem> & { platform?: string; quality?: string | null };
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.title !== 'string'
    || typeof candidate.sourceUrl !== 'string'
    || typeof candidate.kind !== 'string'
    || typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  const createdAt = candidate.createdAt;
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : createdAt;
  const status = candidate.status === 'resolving' || candidate.status === 'resolved' || candidate.status === 'downloaded' || candidate.status === 'failed'
    ? candidate.status
    : 'downloaded';
  const platform = candidate.platform === 'twitter' || candidate.platform === 'instagram' || candidate.platform === 'facebook' || candidate.platform === 'tiktok' || candidate.platform === 'youtube'
    ? candidate.platform
    : 'unknown';
  const quality = candidate.quality === 'high' || candidate.quality === 'medium' || candidate.quality === 'low'
    ? candidate.quality
    : null;

  return {
    id: candidate.id,
    title: candidate.title,
    sourceUrl: candidate.sourceUrl,
    platform,
    kind: candidate.kind as HistoryItem['kind'],
    quality,
    status,
    statusDetail: typeof candidate.statusDetail === 'string' ? candidate.statusDetail : undefined,
    createdAt,
    updatedAt,
  };
}
