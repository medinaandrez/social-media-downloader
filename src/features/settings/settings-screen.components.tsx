import { Linking, Pressable, Text, View } from 'react-native';
import { ArrowLeft, BarChart3, Check, Globe, Languages, Link2, MonitorSmartphone, Trash2, UserRound } from 'lucide-react-native';
import { router } from 'expo-router';

import { t } from '@/i18n/translations';
import type { Language, ThemePreference } from '@/shared/types';
import type { Theme } from '@/theme/palette';

import { makeSettingsStyles } from './settings-screen.styles';

type SettingsStyles = ReturnType<typeof makeSettingsStyles>;

export const languages: Array<{ label: string; value: Language }> = [
  { label: 'Español', value: 'es' },
  { label: 'English', value: 'en' },
];

export const themePreferences: ThemePreference[] = ['system', 'light', 'dark'];

export const projectRepoUrl = 'https://github.com/medinaandrez/social-media-downloader';
export const projectWebsiteUrl = 'https://socialm-downloader.vercel.app';
export const projectMetricsUrl = 'https://socialm-downloader.vercel.app/api/analytics-summary?hours=24';

export function SettingsHeader({
  language,
  styles,
  theme,
}: {
  language: Language;
  styles: SettingsStyles;
  theme: Theme;
}) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
        <ArrowLeft color={theme.colors.text} size={22} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.title}>{t(language, 'settings')}</Text>
        <Text style={styles.subtitle}>{t(language, 'settingsSubtitle')}</Text>
      </View>
    </View>
  );
}

export function SettingsSection({
  children,
  description,
  icon,
  language,
  styles,
  theme,
  titleKey,
}: {
  children: React.ReactNode;
  description: string;
  icon: 'language' | 'theme' | 'history' | 'author';
  language: Language;
  styles: SettingsStyles;
  theme: Theme;
  titleKey: 'language' | 'theme' | 'history' | 'author';
}) {
  const Icon = icon === 'language'
    ? Languages
    : icon === 'theme'
      ? MonitorSmartphone
      : icon === 'history'
        ? Trash2
        : UserRound;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon color={theme.colors.accent} size={20} />
        </View>
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{t(language, titleKey)}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export function OptionButton({
  active,
  label,
  onPress,
  styles,
  theme,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: SettingsStyles;
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

export function LinkButton({
  icon,
  label,
  onPress,
  styles,
  theme,
}: {
  icon: 'globe' | 'link' | 'chart';
  label: string;
  onPress: () => void;
  styles: SettingsStyles;
  theme: Theme;
}) {
  const Icon = icon === 'globe' ? Globe : icon === 'chart' ? BarChart3 : Link2;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.linkButton}>
      <Icon color={theme.colors.accent} size={18} />
      <Text style={styles.linkButtonText}>{label}</Text>
    </Pressable>
  );
}

export async function openExternalUrl(url: string) {
  await Linking.openURL(url);
}
