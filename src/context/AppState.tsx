import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { loadHistory, loadLanguage, loadThemePreference, saveHistory, saveLanguage, saveThemePreference } from '@/services/storage';
import type { HistoryItem, Language, ThemePreference } from '@/shared/types';
import { darkTheme, lightTheme, type Theme } from '@/theme/palette';

type AppContextValue = {
  addHistory: (item: HistoryItem) => Promise<void>;
  clearHistory: () => Promise<void>;
  colorScheme: 'light' | 'dark';
  history: HistoryItem[];
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [storedHistory, storedLanguage, storedThemePreference] = await Promise.all([
        loadHistory(),
        loadLanguage(),
        loadThemePreference(),
      ]);
      if (mounted) {
        setHistory(storedHistory);
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
    addHistory: async (item) => {
      const nextHistory = [item, ...history.filter((entry) => entry.sourceUrl !== item.sourceUrl)].slice(0, 25);
      setHistory(nextHistory);
      await saveHistory(nextHistory);
    },
    clearHistory: async () => {
      setHistory([]);
      await saveHistory([]);
    },
    colorScheme,
    history,
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
  }), [colorScheme, history, language, theme, themePreference]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return context;
}
