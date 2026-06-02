import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ArrowLeft, BarChart3, RefreshCcw } from 'lucide-react-native';
import { router } from 'expo-router';

import { t } from '@/i18n/translations';
import type { AnalyticsSummary } from '@/shared/analytics';
import type { Language } from '@/shared/types';
import type { Theme } from '@/theme/palette';

import { makeMetricsStyles } from './metrics-screen.styles';

type MetricsStyles = ReturnType<typeof makeMetricsStyles>;

export function MetricsHeader({
  language,
  styles,
  theme,
}: {
  language: Language;
  styles: MetricsStyles;
  theme: Theme;
}) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
        <ArrowLeft color={theme.colors.text} size={22} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.title}>{t(language, 'metricsTitle')}</Text>
        <Text style={styles.subtitle}>{t(language, 'metricsSubtitle')}</Text>
      </View>
    </View>
  );
}

export function MetricsRefreshButton({
  language,
  loading,
  onPress,
  styles,
  theme,
}: {
  language: Language;
  loading: boolean;
  onPress: () => void;
  styles: MetricsStyles;
  theme: Theme;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.refreshButton}>
      {loading ? (
        <ActivityIndicator color={theme.colors.onAccent} />
      ) : (
        <RefreshCcw color={theme.colors.onAccent} size={18} />
      )}
      <Text style={styles.refreshText}>{t(language, 'refreshMetrics')}</Text>
    </Pressable>
  );
}

export function StatCard({
  label,
  note,
  value,
  styles,
}: {
  label: string;
  note: string;
  value: string;
  styles: MetricsStyles;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

export function Section({
  children,
  title,
  styles,
}: {
  children: React.ReactNode;
  title: string;
  styles: MetricsStyles;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function MetricRow({
  label,
  value,
  styles,
  isFirst = false,
}: {
  label: string;
  value: string;
  styles: MetricsStyles;
  isFirst?: boolean;
}) {
  return (
    <View style={[styles.listRow, isFirst && styles.listRowFirst]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function EmptyState({
  body,
  title,
  styles,
}: {
  body: string;
  title: string;
  styles: MetricsStyles;
}) {
  return (
    <View style={styles.emptyCard}>
      <BarChart3 color="#7C8A85" size={24} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function ErrorState({
  body,
  title,
  styles,
}: {
  body: string;
  title: string;
  styles: MetricsStyles;
}) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{body}</Text>
    </View>
  );
}

export function makeMetricRows(summary: AnalyticsSummary | null, language: Language) {
  if (!summary) {
    return {
      byEvent: [] as Array<{ label: string; value: string }>,
      byPlatform: [] as Array<{ label: string; value: string }>,
      byError: [] as Array<{ label: string; value: string }>,
    };
  }

  const formatRows = (entries: Record<string, number>) => Object.entries(entries)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label: prettifyKey(label, language), value: String(count) }));

  return {
    byEvent: formatRows(summary.byEvent),
    byPlatform: formatRows(summary.byPlatform),
    byError: formatRows(summary.errorsByType),
  };
}

function prettifyKey(value: string, language: Language) {
  if (language === 'es') {
    return value
      .replace(/_/g, ' ')
      .replace(/\bresolve\b/g, 'resolucion')
      .replace(/\bdownload\b/g, 'descarga');
  }

  return value.replace(/_/g, ' ');
}
