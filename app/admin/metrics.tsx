import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { ArrowLeft, LockKeyhole, RefreshCcw, ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/context/AppState';
import { t } from '@/i18n/translations';
import { fetchAnalyticsSummaryWithToken } from '@/services/analytics';
import { clearAdminMetricsToken, loadAdminMetricsToken, saveAdminMetricsToken } from '@/services/storage';
import type { AnalyticsSummary } from '@/shared/analytics';

import { makeAdminMetricsStyles } from '@/features/admin/admin-metrics.styles';

export default function AdminMetricsScreen() {
  const insets = useSafeAreaInsets();
  const { language, theme } = useAppState();
  const styles = useMemo(() => makeAdminMetricsStyles(theme), [theme]);
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const loadSummary = useCallback(async (providedToken?: string) => {
    const nextToken = (providedToken ?? token).trim();
    if (!nextToken) {
      setStatus(t(language, 'adminTokenRequired'));
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const data = await fetchAnalyticsSummaryWithToken(24, nextToken);
      setSummary(data);
      if (remember) {
        await saveAdminMetricsToken(nextToken);
      }
      setStatus(null);
    } catch (error) {
      setSummary(null);
      const message = error instanceof Error ? error.message : '';
      setStatus(message.includes('401') || message.toLowerCase().includes('unauthorized')
        ? t(language, 'adminTokenRequired')
        : message || t(language, 'adminTokenRequired'));
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }, [language, remember, token]);

  useEffect(() => {
    let mounted = true;

    async function hydrateToken() {
      const storedToken = await loadAdminMetricsToken();
      if (!mounted) {
        return;
      }

      if (storedToken) {
        setToken(storedToken);
        setRemember(true);
        await loadSummary(storedToken);
      } else {
        setInitializing(false);
      }
    }

    hydrateToken();

    return () => {
      mounted = false;
    };
  }, [loadSummary]);

  const totals = summary
    ? [
        { label: t(language, 'metricsTotalEvents'), value: String(summary.totalEvents), note: t(language, 'metricsTotalEventsNote') },
        { label: t(language, 'metricsStorage'), value: summary.storage, note: t(language, 'metricsStorageNote') },
        { label: t(language, 'metricsWindow'), value: `${summary.windowHours}h`, note: t(language, 'metricsWindowNote') },
        { label: t(language, 'metricsUpdated'), value: summary.lastUpdatedAt ? new Date(summary.lastUpdatedAt).toLocaleString(language === 'es' ? 'es-ES' : 'en-US') : '-', note: t(language, 'metricsUpdatedNote') },
      ]
    : [];

  const counts = summary
    ? [
        { label: t(language, 'metricsByEvent'), value: summary.byEvent },
        { label: t(language, 'metricsByPlatform'), value: summary.byPlatform },
        { label: t(language, 'metricsByError'), value: summary.errorsByType },
      ]
    : [];

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
          <Text style={styles.title}>Admin metrics</Text>
          <Text style={styles.subtitle}>{t(language, 'adminAccessBody')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <LockKeyhole color={theme.colors.accent} size={18} />
          <Text style={styles.cardTitle}>{t(language, 'adminAccessTitle')}</Text>
        </View>
        <Text style={styles.cardBody}>{t(language, 'adminAccessBody')}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t(language, 'adminTokenPlaceholder')}
          placeholderTextColor={theme.colors.placeholder}
          secureTextEntry
          style={styles.input}
          value={token}
          onChangeText={setToken}
        />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t(language, 'adminRemember')}</Text>
          <Switch
            trackColor={{ false: theme.colors.border, true: theme.colors.accentSoft }}
            thumbColor={remember ? theme.colors.accent : theme.colors.mutedText}
            value={remember}
            onValueChange={setRemember}
          />
        </View>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={() => loadSummary()} style={styles.button}>
            {loading ? (
              <ActivityIndicator color={theme.colors.onAccent} />
            ) : (
              <Text style={styles.buttonText}>{t(language, 'adminUnlock')}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              setToken('');
              setSummary(null);
              setStatus(null);
              await clearAdminMetricsToken();
            }}
            style={styles.buttonGhost}
          >
            <Text style={styles.buttonGhostText}>{t(language, 'adminClearToken')}</Text>
          </Pressable>
        </View>
        {status ? (
          <Text style={styles.status}>{status}</Text>
        ) : null}
      </View>

      {initializing ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : summary ? (
        <>
          <View style={styles.statsGrid}>
            {totals.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statNote}>{item.note}</Text>
              </View>
            ))}
          </View>

          {counts.map((item) => (
            <View key={item.label} style={styles.section}>
              <Text style={styles.sectionTitle}>{item.label}</Text>
              {Object.entries(item.value).length ? Object.entries(item.value).sort((a, b) => b[1] - a[1]).map(([label, value], index) => (
                <View key={label} style={index === 0 ? undefined : styles.divider}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{label.replace(/_/g, ' ')}</Text>
                    <Text style={styles.rowValue}>{String(value)}</Text>
                  </View>
                </View>
              )) : (
                <Text style={styles.cardBody}>{t(language, 'metricsNoBreakdownBody')}</Text>
              )}
            </View>
          ))}
        </>
      ) : (
        <View style={styles.card}>
          <ShieldCheck color={theme.colors.accent} size={22} />
          <Text style={styles.cardTitle}>{t(language, 'adminLockedTitle')}</Text>
          <Text style={styles.cardBody}>{t(language, 'adminLockedBody')}</Text>
        </View>
      )}

      {summary ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => loadSummary()}
          style={styles.buttonGhost}
        >
          <RefreshCcw color={theme.colors.text} size={18} />
          <Text style={styles.buttonGhostText}>{t(language, 'refreshMetrics')}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
