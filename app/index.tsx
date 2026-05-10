import { type ComponentType, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Check,
  Clipboard,
  Download,
  Link,
  Music,
  Play,
  RefreshCw,
  Settings,
  Share2,
  Sparkles,
  Video,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoClipboard from 'expo-clipboard';
import { router } from 'expo-router';

import { useAppState } from '@/context/AppState';
import { t } from '@/i18n/translations';
import { downloadResolvedFormat } from '@/services/downloads';
import { resolveMedia } from '@/services/resolver';
import { detectPlatform, platforms } from '@/shared/platforms';
import type { DownloadFormat, HistoryItem, MediaKind, PlatformId, Quality, ResolvedMedia } from '@/shared/types';
import type { Theme } from '@/theme/palette';
import { makeHistoryItem } from '@/utils/history';

const qualities: Quality[] = ['high', 'medium', 'low'];
const mediaKinds: MediaKind[] = ['video', 'audio'];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { addHistory, history, language, theme } = useAppState();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [url, setUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | 'auto'>('auto');
  const [selectedQuality, setSelectedQuality] = useState<Quality>('high');
  const [selectedKind, setSelectedKind] = useState<MediaKind>('video');
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionFormat, setActionFormat] = useState<DownloadFormat | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const copyFromClipboard = async () => {
    const copiedText = await ExpoClipboard.getStringAsync();
    if (copiedText) {
      setUrl(copiedText.trim());
      setResolved(null);
      const detected = detectPlatform(copiedText);
      if (detected) {
        setSelectedPlatform(detected);
      }
    }
  };

  const handlePlatformChange = (platform: PlatformId | 'auto') => {
    setSelectedPlatform(platform);
    setResolved(null);
    setSelectedFormatId(null);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setResolved(null);
    setSelectedFormatId(null);
    if (selectedPlatform === 'auto') {
      const detected = detectPlatform(value);
      if (detected) {
        setSelectedPlatform(detected);
      }
    }
  };

  const handleResolve = async () => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      Alert.alert(t(language, 'missingUrlTitle'), t(language, 'missingUrlBody'));
      return;
    }

    setLoading(true);
    try {
      const media = await resolveMedia({
        url: cleanUrl,
        platform: selectedPlatform === 'auto' ? undefined : selectedPlatform,
        language,
      });
      setResolved(media);
      setSelectedPlatform(media.platform);
      const preferred = pickPreferredFormat(media.formats, selectedKind, selectedQuality);
      setSelectedFormatId(preferred?.id ?? null);
      if (!preferred) {
        const nextFormat = media.formats[0];
        if (nextFormat) {
          setSelectedKind(nextFormat.kind);
          setSelectedQuality(nextFormat.quality);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'genericError');
      Alert.alert(t(language, 'resolveErrorTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  const selectedFormat = useMemo(
    () => {
      const formats = resolved?.formats ?? [];
      return formats.find((format) => format.id === selectedFormatId && format.kind === selectedKind)
        ?? pickPreferredFormat(formats, selectedKind, selectedQuality);
    },
    [resolved, selectedFormatId, selectedKind, selectedQuality],
  );

  const visibleFormats = useMemo(
    () => (resolved?.formats ?? []).filter((format) => format.kind === selectedKind),
    [resolved, selectedKind],
  );

  const detectedPlatform = useMemo(() => detectPlatform(url), [url]);
  const hasValidLink = Boolean(url.trim() && detectedPlatform);
  const canShowPreviewButton = hasValidLink || loading;

  const handleOpenActions = () => {
    if (resolved && selectedFormat) {
      setActionFormat(selectedFormat);
    }
  };

  const handleAction = async (mode: 'save' | 'share') => {
    if (!resolved || !actionFormat) {
      return;
    }

    setActionBusy(true);
    try {
      await downloadResolvedFormat({ media: resolved, format: actionFormat, mode, language });
      await addHistory(makeHistoryItem(resolved, actionFormat));
      setActionFormat(null);
      Alert.alert(t(language, 'doneTitle'), t(language, mode === 'save' ? 'savedBody' : 'sharedBody'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'genericError');
      Alert.alert(t(language, 'downloadErrorTitle'), message);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 16, 28),
            paddingBottom: Math.max(insets.bottom + 28, 36),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <View style={styles.brandMark}>
              <Sparkles color={theme.colors.accent} size={24} strokeWidth={2.2} />
            </View>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Social Media Downloader</Text>
          </View>
          <View style={styles.headerSide}>
            <Pressable
              accessibilityLabel={t(language, 'settings')}
              accessibilityRole="button"
              onPress={() => router.push('/settings')}
              style={styles.headerIconButton}
            >
              <Settings color={theme.colors.mutedText} size={22} />
            </Pressable>
          </View>
        </View>

        <View style={styles.linkPanel}>
          <View style={styles.inputShell}>
            <Link color={theme.colors.mutedText} size={20} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={handleUrlChange}
              onSubmitEditing={handleResolve}
              placeholder={t(language, 'urlPlaceholder')}
              placeholderTextColor={theme.colors.placeholder}
              returnKeyType="search"
              style={styles.input}
              value={url}
            />
            {url ? (
              <Pressable accessibilityRole="button" onPress={() => handleUrlChange('')} style={styles.iconButton}>
                <X color={theme.colors.mutedText} size={18} />
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={copyFromClipboard} style={styles.iconButton}>
                <Clipboard color={theme.colors.mutedText} size={18} />
              </Pressable>
            )}
          </View>

          <View style={styles.platformGrid}>
            <PlatformButton
              active={selectedPlatform === 'auto'}
              label={t(language, 'auto')}
              onPress={() => handlePlatformChange('auto')}
              styles={styles}
            />
            {platforms.map((platform) => (
              <PlatformButton
                active={selectedPlatform === platform.id}
                key={platform.id}
                label={platform.label}
                onPress={() => handlePlatformChange(platform.id)}
                styles={styles}
              />
            ))}
          </View>

          {canShowPreviewButton ? (
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={handleResolve}
              style={[styles.primaryButton, loading && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onAccent} />
              ) : (
                <>
                  <RefreshCw color={theme.colors.onAccent} size={20} />
                  <Text style={styles.primaryButtonText}>{t(language, 'previewButton')}</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.controlsRow}>
          <SegmentedControl
            icons={{ audio: Music, video: Video }}
            labels={{ audio: t(language, 'audio'), video: t(language, 'video') }}
            onChange={(kind) => {
              setSelectedKind(kind);
              setSelectedFormatId(null);
            }}
            options={mediaKinds}
            selected={selectedKind}
            styles={styles}
            theme={theme}
          />
          <SegmentedControl
            labels={{ high: t(language, 'high'), medium: t(language, 'medium'), low: t(language, 'low') }}
            onChange={(quality) => {
              setSelectedQuality(quality);
              setSelectedFormatId(null);
            }}
            options={qualities}
            selected={selectedQuality}
            styles={styles}
            theme={theme}
          />
        </View>

        {resolved ? (
          <View style={styles.previewCard}>
            <View style={styles.thumbnailWrap}>
              {resolved.thumbnailUrl ? (
                <Image source={{ uri: resolved.thumbnailUrl }} style={styles.thumbnail} />
              ) : (
                <View style={styles.thumbnailFallback}>
                  <Play color={theme.colors.accent} fill={theme.colors.accentSoft} size={34} />
                </View>
              )}
            </View>
            <View style={styles.previewInfo}>
              <View style={styles.platformPill}>
                <Text style={styles.platformPillText}>{platformLabel(resolved.platform)}</Text>
              </View>
              <Text numberOfLines={2} style={styles.previewTitle}>
                {resolved.title}
              </Text>
              <Text numberOfLines={1} style={styles.previewMeta}>
                {resolved.author || t(language, 'publicProfile')}
                {resolved.durationLabel ? ` - ${resolved.durationLabel}` : ''}
              </Text>
              {resolved.notice ? <Text style={styles.notice}>{resolved.notice}</Text> : null}
              {visibleFormats.length > 0 ? (
                <View style={styles.formatSection}>
                  <Text style={styles.formatLabel}>{t(language, 'formats')}</Text>
                  <View style={styles.formatGrid}>
                    {visibleFormats.map((format) => {
                      const active = selectedFormat?.id === format.id;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={format.id}
                          onPress={() => {
                            setSelectedFormatId(format.id);
                            setSelectedQuality(format.quality);
                          }}
                          style={[styles.formatButton, active && styles.formatButtonActive]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.formatButtonText, active && styles.formatButtonTextActive]}
                          >
                            {format.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={!selectedFormat?.downloadUrl}
                onPress={handleOpenActions}
                style={[styles.downloadButton, !selectedFormat?.downloadUrl && styles.disabledButton]}
              >
                <Download color={theme.colors.onAccent} size={20} />
                <Text style={styles.downloadButtonText}>
                  {selectedFormat?.downloadUrl ? t(language, 'downloadButton') : t(language, 'extractorPending')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Play color={theme.colors.accent} fill={theme.colors.accentSoft} size={30} />
            <Text style={styles.emptyTitle}>{t(language, 'emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t(language, 'emptyBody')}</Text>
          </View>
        )}

        <View style={styles.noticeStrip}>
          <Check color={theme.colors.success} size={18} />
          <Text style={styles.noticeStripText}>{t(language, 'publicContentNotice')}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(language, 'history')}</Text>
        </View>

        <View style={styles.historyList}>
          {history.length === 0 ? (
            <Text style={styles.historyEmpty}>{t(language, 'historyEmpty')}</Text>
          ) : (
            history.map((item) => <HistoryRow item={item} key={item.id} styles={styles} theme={theme} />)
          )}
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={Boolean(actionFormat)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionTitle}>{t(language, 'chooseAction')}</Text>
            <Text style={styles.actionBody}>{t(language, 'chooseActionBody')}</Text>
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={() => handleAction('save')}
                style={[styles.sheetButton, actionBusy && styles.disabledButton]}
              >
                <Download color={theme.colors.onAccent} size={20} />
                <Text style={styles.sheetButtonText}>{t(language, 'save')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={() => handleAction('share')}
                style={[styles.sheetButtonSecondary, actionBusy && styles.disabledButton]}
              >
                <Share2 color={theme.colors.text} size={20} />
                <Text style={styles.sheetButtonSecondaryText}>{t(language, 'share')}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={actionBusy}
              onPress={() => setActionFormat(null)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>{t(language, 'cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PlatformButton({
  active,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.platformButton, active && styles.platformButtonActive]}
    >
      <Text numberOfLines={1} style={[styles.platformButtonText, active && styles.platformButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SegmentedControl<T extends string>({
  icons,
  labels,
  onChange,
  options,
  selected,
  styles,
  theme,
}: {
  icons?: Partial<Record<T, LucideIcon>>;
  labels: Record<T, string>;
  onChange: (value: T) => void;
  options: T[];
  selected: T;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  return (
    <View style={styles.segmentShell}>
      {options.map((option) => {
        const Icon = icons?.[option];
        const active = selected === option;
        return (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
          >
            {Icon ? (
              <SegmentIcon
                Icon={Icon}
                color={active ? theme.colors.onAccent : theme.colors.mutedText}
              />
            ) : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{labels[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SegmentIcon({ Icon, color }: { Icon: LucideIcon; color: string }) {
  const IconComponent = Icon as ComponentType<{ color: string; size: number }>;
  return <IconComponent color={color} size={16} />;
}

function HistoryRow({
  item,
  styles,
  theme,
}: {
  item: HistoryItem;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIcon}>
        {item.kind === 'video' ? (
          <Video color={theme.colors.accent} size={18} />
        ) : (
          <Music color={theme.colors.accent} size={18} />
        )}
      </View>
      <View style={styles.historyTextWrap}>
        <Text numberOfLines={1} style={styles.historyTitle}>
          {item.title}
        </Text>
        <Text style={styles.historyMeta}>
          {platformLabel(item.platform)} - {item.kind.toUpperCase()} - {item.quality.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function pickPreferredFormat(formats: DownloadFormat[], kind: MediaKind, quality: Quality) {
  return formats.find((format) => format.kind === kind && format.quality === quality)
    ?? formats.find((format) => format.kind === kind)
    ?? formats[0];
}

function platformLabel(platform: PlatformId) {
  return platforms.find((item) => item.id === platform)?.label ?? platform;
}

function makeStyles(theme: Theme) {
  const colors = theme.colors;

  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      gap: 18,
      marginHorizontal: 'auto',
      maxWidth: 860,
      paddingHorizontal: 18,
      width: '100%',
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    headerSide: {
      alignItems: 'center',
      minWidth: 50,
    },
    brandMark: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      height: 50,
      justifyContent: 'center',
      width: 50,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 31,
      textAlign: 'center',
    },
    headerIconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    linkPanel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 14,
      minHeight: 176,
      padding: 14,
    },
    inputShell: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 54,
      paddingHorizontal: 14,
    },
    input: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      minWidth: 0,
      paddingVertical: 12,
    },
    iconButton: {
      alignItems: 'center',
      borderRadius: 8,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    platformGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    platformButton: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      minWidth: 88,
      paddingHorizontal: 12,
    },
    platformButtonActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    platformButtonText: {
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: '700',
    },
    platformButtonTextActive: {
      color: colors.accent,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 8,
      height: 52,
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: '800',
    },
    disabledButton: {
      opacity: 0.48,
    },
    controlsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    segmentShell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      padding: 6,
    },
    segmentButton: {
      alignItems: 'center',
      borderRadius: 6,
      flexDirection: 'row',
      gap: 6,
      height: 38,
      justifyContent: 'center',
      minWidth: 82,
      paddingHorizontal: 12,
    },
    segmentButtonActive: {
      backgroundColor: colors.accent,
    },
    segmentText: {
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '800',
    },
    segmentTextActive: {
      color: colors.onAccent,
    },
    previewCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      gap: 14,
      overflow: 'hidden',
      padding: 12,
    },
    thumbnailWrap: {
      aspectRatio: 16 / 10,
      backgroundColor: colors.input,
      borderRadius: 8,
      overflow: 'hidden',
      width: Platform.OS === 'web' ? 250 : '100%',
    },
    thumbnail: {
      height: '100%',
      width: '100%',
    },
    thumbnailFallback: {
      alignItems: 'center',
      backgroundColor: colors.preview,
      height: '100%',
      justifyContent: 'center',
      width: '100%',
    },
    previewInfo: {
      flex: 1,
      gap: 8,
      justifyContent: 'center',
      minWidth: 0,
    },
    platformPill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 28,
      paddingHorizontal: 12,
    },
    platformPillText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '800',
    },
    previewTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 25,
    },
    previewMeta: {
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: '600',
    },
    notice: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    formatSection: {
      gap: 8,
      marginTop: 2,
    },
    formatLabel: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    formatGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    formatButton: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      height: 36,
      justifyContent: 'center',
      maxWidth: '100%',
      paddingHorizontal: 10,
    },
    formatButtonActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    formatButtonText: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '800',
    },
    formatButtonTextActive: {
      color: colors.accent,
    },
    downloadButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.accent,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 8,
      height: 46,
      justifyContent: 'center',
      marginTop: 4,
      minWidth: 180,
      paddingHorizontal: 16,
    },
    downloadButtonText: {
      color: colors.onAccent,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyState: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 28,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      maxWidth: 480,
      textAlign: 'center',
    },
    noticeStrip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    noticeStripText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginTop: 4,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    historyList: {
      gap: 10,
    },
    historyEmpty: {
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: '600',
      paddingVertical: 10,
    },
    historyRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 64,
      padding: 12,
    },
    historyIcon: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 8,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    historyTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    historyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    historyMeta: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    modalBackdrop: {
      alignItems: 'center',
      backgroundColor: colors.backdrop,
      flex: 1,
      justifyContent: 'flex-end',
      padding: 16,
    },
    actionSheet: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 12,
      maxWidth: 520,
      padding: 18,
      width: '100%',
    },
    actionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    actionBody: {
      color: colors.mutedText,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    sheetButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 8,
      flexDirection: 'row',
      flexGrow: 1,
      gap: 8,
      height: 48,
      justifyContent: 'center',
      minWidth: 140,
      paddingHorizontal: 14,
    },
    sheetButtonText: {
      color: colors.onAccent,
      fontSize: 15,
      fontWeight: '800',
    },
    sheetButtonSecondary: {
      alignItems: 'center',
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      flexGrow: 1,
      gap: 8,
      height: 48,
      justifyContent: 'center',
      minWidth: 140,
      paddingHorizontal: 14,
    },
    sheetButtonSecondaryText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    cancelButton: {
      alignItems: 'center',
      height: 42,
      justifyContent: 'center',
    },
    cancelButtonText: {
      color: colors.mutedText,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
