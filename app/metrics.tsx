import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/context/AppState';
import { t } from '@/i18n/translations';
import { fetchAnalyticsSummary } from '@/services/analytics';
import type { AnalyticsSummary } from '@/shared/analytics';

import {
  EmptyState,
  ErrorState,
  makeMetricRows,
  MetricsHeader,
  MetricsRefreshButton,
  MetricRow,
  Section,
  StatCard,
} from '@/features/metrics/metrics-screen.components';
import { makeMetricsStyles } from '@/features/metrics/metrics-screen.styles';

export default function MetricsScreen() {
  const insets = useSafeAreaInsets();
  const { language, theme } = useAppState();
  const styles = useMemo(() => makeMetricsStyles(theme), [theme]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const data = await fetchAnalyticsSummary(24);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(language, 'metricsLoadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const rows = makeMetricRows(summary, language);
  const hasData = Boolean(summary && summary.totalEvents > 0);

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
      <MetricsHeader language={language} styles={styles} theme={theme} />

      <View style={styles.controls}>
        <MetricsRefreshButton language={language} loading={refreshing} onPress={loadSummary} styles={styles} theme={theme} />
        <Text style={styles.secondaryText}>{t(language, 'metricsEndpointNote')}</Text>
      </View>

      {error ? <ErrorState body={error} styles={styles} title={t(language, 'metricsErrorTitle')} /> : null}

      {loading ? (
        <EmptyState body={t(language, 'metricsLoadingBody')} styles={styles} title={t(language, 'metricsLoadingTitle')} />
      ) : hasData ? (
        <>
          <View style={styles.summaryGrid}>
            <StatCard
              label={t(language, 'metricsTotalEvents')}
              note={t(language, 'metricsTotalEventsNote')}
              styles={styles}
              value={String(summary?.totalEvents ?? 0)}
            />
            <StatCard
              label={t(language, 'metricsStorage')}
              note={t(language, 'metricsStorageNote')}
              styles={styles}
              value={summary?.storage ?? '-'}
            />
            <StatCard
              label={t(language, 'metricsWindow')}
              note={t(language, 'metricsWindowNote')}
              styles={styles}
              value={`${summary?.windowHours ?? 24}h`}
            />
            <StatCard
              label={t(language, 'metricsUpdated')}
              note={t(language, 'metricsUpdatedNote')}
              styles={styles}
              value={summary?.lastUpdatedAt ? new Date(summary.lastUpdatedAt).toLocaleString(language === 'es' ? 'es-ES' : 'en-US') : '-'}
            />
          </View>

          <Section styles={styles} title={t(language, 'metricsByEvent')}>
            {rows.byEvent.length ? rows.byEvent.map((row, index) => (
              <MetricRow key={row.label} isFirst={index === 0} label={row.label} styles={styles} value={row.value} />
            )) : <EmptyState body={t(language, 'metricsNoBreakdownBody')} styles={styles} title={t(language, 'metricsNoBreakdownTitle')} />}
          </Section>

          <Section styles={styles} title={t(language, 'metricsByPlatform')}>
            {rows.byPlatform.length ? rows.byPlatform.map((row, index) => (
              <MetricRow key={row.label} isFirst={index === 0} label={row.label} styles={styles} value={row.value} />
            )) : <EmptyState body={t(language, 'metricsNoBreakdownBody')} styles={styles} title={t(language, 'metricsNoBreakdownTitle')} />}
          </Section>

          <Section styles={styles} title={t(language, 'metricsByError')}>
            {rows.byError.length ? rows.byError.map((row, index) => (
              <MetricRow key={row.label} isFirst={index === 0} label={row.label} styles={styles} value={row.value} />
            )) : <EmptyState body={t(language, 'metricsNoErrorsBody')} styles={styles} title={t(language, 'metricsNoErrorsTitle')} />}
          </Section>
        </>
      ) : (
        <EmptyState body={t(language, 'metricsEmptyBody')} styles={styles} title={t(language, 'metricsEmptyTitle')} />
      )}
    </ScrollView>
  );
}
