import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Check, Languages, MonitorSmartphone, Trash2 } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/context/AppState';
import { t } from '@/i18n/translations';
import type { Language, ThemePreference } from '@/shared/types';
import type { Theme } from '@/theme/palette';

const languages: Array<{ label: string; value: Language }> = [
  { label: 'Español', value: 'es' },
  { label: 'English', value: 'en' },
];

const themePreferences: ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    clearHistory,
    history,
    language,
    setLanguage,
    setThemePreference,
    theme,
    themePreference,
  } = useAppState();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 16, 28),
          paddingBottom: Math.max(insets.bottom + 28, 36),
        },
      ]}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={theme.colors.text} size={22} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t(language, 'settings')}</Text>
          <Text style={styles.subtitle}>{t(language, 'settingsSubtitle')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Languages color={theme.colors.accent} size={20} />
          </View>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>{t(language, 'language')}</Text>
            <Text style={styles.sectionDescription}>{t(language, 'languageDescription')}</Text>
          </View>
        </View>
        <View style={styles.optionGrid}>
          {languages.map((item) => (
            <OptionButton
              active={language === item.value}
              key={item.value}
              label={item.label}
              onPress={() => setLanguage(item.value)}
              styles={styles}
              theme={theme}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <MonitorSmartphone color={theme.colors.accent} size={20} />
          </View>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>{t(language, 'theme')}</Text>
            <Text style={styles.sectionDescription}>{t(language, 'themeDescription')}</Text>
          </View>
        </View>
        <View style={styles.optionGrid}>
          {themePreferences.map((item) => (
            <OptionButton
              active={themePreference === item}
              key={item}
              label={t(language, item)}
              onPress={() => setThemePreference(item)}
              styles={styles}
              theme={theme}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Trash2 color={theme.colors.accent} size={20} />
          </View>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>{t(language, 'history')}</Text>
            <Text style={styles.sectionDescription}>{t(language, 'clearHistoryDescription')}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={history.length === 0}
          onPress={clearHistory}
          style={[styles.clearButton, history.length === 0 && styles.disabledButton]}
        >
          <Trash2 color={theme.colors.onAccent} size={18} />
          <Text style={styles.clearButtonText}>{t(language, 'clear')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function OptionButton({
  active,
  label,
  onPress,
  styles,
  theme,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.optionButton, active && styles.optionButtonActive]}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
      {active ? <Check color={theme.colors.accent} size={18} /> : null}
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  const colors = theme.colors;

  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      gap: 16,
      marginHorizontal: 'auto',
      maxWidth: 760,
      paddingHorizontal: 18,
      width: '100%',
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 34,
    },
    subtitle: {
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      marginTop: 2,
    },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 14,
      padding: 14,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    sectionIcon: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 8,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    sectionText: {
      flex: 1,
      minWidth: 0,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: 0,
    },
    sectionDescription: {
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 2,
    },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    optionButton: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      height: 44,
      justifyContent: 'center',
      minWidth: 116,
      paddingHorizontal: 14,
    },
    optionButtonActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    optionText: {
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: '800',
    },
    optionTextActive: {
      color: colors.accent,
    },
    clearButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.accent,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 8,
      height: 46,
      justifyContent: 'center',
      minWidth: 136,
      paddingHorizontal: 16,
    },
    clearButtonText: {
      color: colors.onAccent,
      fontSize: 15,
      fontWeight: '800',
    },
    disabledButton: {
      opacity: 0.48,
    },
  });
}
