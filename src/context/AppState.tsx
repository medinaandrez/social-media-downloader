import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

import { historyLimit } from '@/config/appConfig';
import {
  loadFailureReports,
  loadHistory,
  loadLanguage,
  loadThemePreference,
  saveFailureReports,
  saveHistory,
  saveLanguage,
  saveThemePreference,
} from '@/services/storage';
import type { FailureReport, HistoryItem, Language, ThemePreference } from '@/shared/types';
import { darkTheme, lightTheme, type Theme } from '@/theme/palette';

type AppContextValue = {
  addFailureReport: (item: FailureReport) => Promise<void>;
  addHistory: (item: HistoryItem) => Promise<void>;
  clearHistory: () => Promise<void>;
  failureReports: FailureReport[];
  colorScheme: 'light' | 'dark';
  history: HistoryItem[];
  removeHistoryItem: (id: string) => Promise<void>;
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  setThemePreference: (themePreference: ThemePreference) => Promise<void>;
  theme: Theme;
  themePreference: ThemePreference;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const colorScheme = themePreference === 'system' ? systemScheme === 'dark' ? 'dark' : 'light' : themePreference;
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const [failureReports, setFailureReports] = useState<FailureReport[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyRef = useRef<HistoryItem[]>([]);
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [storedHistory, storedFailureReports, storedLanguage, storedThemePreference] = await Promise.all([
        loadHistory(),
        loadFailureReports(),
        loadLanguage(),
        loadThemePreference(),
      ]);
      if (mounted) {
        setHistory(storedHistory);
        historyRef.current = storedHistory;
        setFailureReports(storedFailureReports);
        setLanguageState(storedLanguage);
        setThemePreferenceState(storedThemePreference);
      }
    }

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    addFailureReport: async (item) => {
      const nextReports = [item, ...failureReports.filter((entry) => entry.url !== item.url)].slice(0, historyLimit);
      setFailureReports(nextReports);
      await saveFailureReports(nextReports);
    },
    addHistory: async (item) => {
      const nextHistory = upsertHistory(historyRef.current, item).slice(0, historyLimit);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      await saveHistory(nextHistory);
    },
    clearHistory: async () => {
      historyRef.current = [];
      setHistory([]);
      await saveHistory([]);
    },
    colorScheme,
    failureReports,
    history,
    removeHistoryItem: async (id) => {
      const nextHistory = historyRef.current.filter((entry) => entry.id !== id);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      await saveHistory(nextHistory);
    },
    language,
    setLanguage: async (nextLanguage) => {
      setLanguageState(nextLanguage);
      await saveLanguage(nextLanguage);
    },
    setThemePreference: async (nextThemePreference) => {
      setThemePreferenceState(nextThemePreference);
      await saveThemePreference(nextThemePreference);
    },
    theme,
    themePreference,
  }), [colorScheme, failureReports, history, language, theme, themePreference]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function upsertHistory(history: HistoryItem[], item: HistoryItem) {
  const existing = history.filter((entry) => entry.sourceUrl !== item.sourceUrl);
  const merged: HistoryItem = {
    ...item,
    createdAt: history.find((entry) => entry.sourceUrl === item.sourceUrl)?.createdAt ?? item.createdAt,
  };

  return [merged, ...existing];
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return context;
}
