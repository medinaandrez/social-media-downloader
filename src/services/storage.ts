import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HistoryItem, Language, ThemePreference } from '@/shared/types';

const HISTORY_KEY = 'smd:history';
const LANGUAGE_KEY = 'smd:language';
const THEME_PREFERENCE_KEY = 'smd:theme-preference';

export async function loadHistory() {
  const value = await AsyncStorage.getItem(HISTORY_KEY);
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as HistoryItem[];
  } catch {
    return [];
  }
}

export async function saveHistory(items: HistoryItem[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 25)));
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
