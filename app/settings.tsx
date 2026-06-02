import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/context/AppState';
import {
  languages,
  LinkButton,
  openExternalUrl,
  OptionButton,
  projectMetricsUrl,
  projectRepoUrl,
  projectWebsiteUrl,
  SettingsHeader,
  SettingsSection,
  themePreferences,
} from '@/features/settings/settings-screen.components';
import { makeSettingsStyles } from '@/features/settings/settings-screen.styles';
import { t } from '@/i18n/translations';

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
  const styles = useMemo(() => makeSettingsStyles(theme), [theme]);

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
      <SettingsHeader language={language} styles={styles} theme={theme} />

      <SettingsSection
        description={t(language, 'languageDescription')}
        icon="language"
        language={language}
        styles={styles}
        theme={theme}
        titleKey="language"
      >
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
      </SettingsSection>

      <SettingsSection
        description={t(language, 'themeDescription')}
        icon="theme"
        language={language}
        styles={styles}
        theme={theme}
        titleKey="theme"
      >
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
      </SettingsSection>

      <SettingsSection
        description={t(language, 'clearHistoryDescription')}
        icon="history"
        language={language}
        styles={styles}
        theme={theme}
        titleKey="history"
      >
        <Pressable
          accessibilityRole="button"
          disabled={history.length === 0}
          onPress={clearHistory}
          style={[styles.clearButton, history.length === 0 && styles.disabledButton]}
        >
          <Trash2 color={theme.colors.onAccent} size={18} />
          <Text style={styles.clearButtonText}>{t(language, 'clear')}</Text>
        </Pressable>
      </SettingsSection>

      <SettingsSection
        description={t(language, 'authorDescription')}
        icon="author"
        language={language}
        styles={styles}
        theme={theme}
        titleKey="author"
      >
        <View style={styles.authorCard}>
          <Text style={styles.authorName}>{t(language, 'authorName')}</Text>
          <Text style={styles.authorRole}>{t(language, 'authorRole')}</Text>
        </View>
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{t(language, 'youtubeBestEffortTitle')}</Text>
          <Text style={styles.noticeBody}>{t(language, 'youtubeBestEffortBody')}</Text>
        </View>
        <View style={styles.optionGrid}>
          <LinkButton
            icon="globe"
            label={t(language, 'viewWebsite')}
            onPress={() => openExternalUrl(projectWebsiteUrl)}
            styles={styles}
            theme={theme}
          />
          <LinkButton
            icon="globe"
            label={t(language, 'viewMetrics')}
            onPress={() => openExternalUrl(projectMetricsUrl)}
            styles={styles}
            theme={theme}
          />
          <LinkButton
            icon="link"
            label={t(language, 'viewProject')}
            onPress={() => openExternalUrl(projectRepoUrl)}
            styles={styles}
            theme={theme}
          />
        </View>
      </SettingsSection>
    </ScrollView>
  );
}
