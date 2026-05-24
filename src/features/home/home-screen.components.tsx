import { type ComponentType } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
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
import { router } from 'expo-router';

import { t } from '@/i18n/translations';
import { platforms } from '@/shared/platforms';
import type { DownloadFormat, HistoryItem, MediaKind, PlatformId, ResolvedMedia } from '@/shared/types';
import type { Theme } from '@/theme/palette';

import { mediaKinds, platformLabel } from './home-screen.helpers';
import { makeHomeStyles } from './home-screen.styles';

type HomeStyles = ReturnType<typeof makeHomeStyles>;

export function HomeHeader({
  language,
  styles,
  theme,
}: {
  language: 'es' | 'en';
  styles: HomeStyles;
  theme: Theme;
}) {
  return (
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
  );
}

export function LinkPanel({
  canShowPreviewButton,
  copyFromClipboard,
  handlePlatformChange,
  handleResolve,
  handleUrlChange,
  language,
  loading,
  selectedPlatform,
  styles,
  theme,
  url,
}: {
  canShowPreviewButton: boolean;
  copyFromClipboard: () => Promise<void>;
  handlePlatformChange: (platform: PlatformId | 'auto') => void;
  handleResolve: () => Promise<void>;
  handleUrlChange: (value: string) => void;
  language: 'es' | 'en';
  loading: boolean;
  selectedPlatform: PlatformId | 'auto';
  styles: HomeStyles;
  theme: Theme;
  url: string;
}) {
  return (
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
  );
}

export function MediaKindControl({
  disabledMediaKinds,
  language,
  onChange,
  selectedKind,
  styles,
  theme,
}: {
  disabledMediaKinds: MediaKind[];
  language: 'es' | 'en';
  onChange: (kind: MediaKind) => void;
  selectedKind: MediaKind;
  styles: HomeStyles;
  theme: Theme;
}) {
  return (
    <View style={styles.controlsRow}>
      <SegmentedControl
        icons={{ audio: Music, video: Video }}
        labels={{ audio: t(language, 'audio'), video: t(language, 'video') }}
        onChange={onChange}
        options={mediaKinds}
        selected={selectedKind}
        disabledOptions={disabledMediaKinds}
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

export function PreviewCard({
  language,
  onDownload,
  onSelectFormat,
  resolved,
  selectedFormat,
  styles,
  theme,
  visibleFormats,
}: {
  language: 'es' | 'en';
  onDownload: () => void;
  onSelectFormat: (formatId: string) => void;
  resolved: ResolvedMedia;
  selectedFormat: DownloadFormat | null;
  styles: HomeStyles;
  theme: Theme;
  visibleFormats: DownloadFormat[];
}) {
  return (
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
                    onPress={() => onSelectFormat(format.id)}
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
        ) : (
          <Text style={styles.unavailableText}>{t(language, 'formatUnavailable')}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={!selectedFormat}
          onPress={onDownload}
          style={[styles.downloadButton, !selectedFormat && styles.disabledButton]}
        >
          <Download color={theme.colors.onAccent} size={20} />
          <Text style={styles.downloadButtonText}>
            {selectedFormat ? t(language, 'downloadButton') : t(language, 'extractorPending')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function EmptyStateCard({
  language,
  styles,
  theme,
}: {
  language: 'es' | 'en';
  styles: HomeStyles;
  theme: Theme;
}) {
  return (
    <View style={styles.emptyState}>
      <Play color={theme.colors.accent} fill={theme.colors.accentSoft} size={30} />
      <Text style={styles.emptyTitle}>{t(language, 'emptyTitle')}</Text>
      <Text style={styles.emptyText}>{t(language, 'emptyBody')}</Text>
    </View>
  );
}

export function PublicNoticeStrip({
  language,
  styles,
  theme,
}: {
  language: 'es' | 'en';
  styles: HomeStyles;
  theme: Theme;
}) {
  return (
    <View style={styles.noticeStrip}>
      <Check color={theme.colors.success} size={18} />
      <Text style={styles.noticeStripText}>{t(language, 'publicContentNotice')}</Text>
    </View>
  );
}

export function HistorySection({
  history,
  language,
  styles,
  theme,
}: {
  history: HistoryItem[];
  language: 'es' | 'en';
  styles: HomeStyles;
  theme: Theme;
}) {
  return (
    <>
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
    </>
  );
}

export function ActionSheet({
  actionBusy,
  actionFormat,
  actionPhase,
  closeActionSheet,
  handleAction,
  language,
  styles,
  theme,
}: {
  actionBusy: boolean;
  actionFormat: DownloadFormat | null;
  actionPhase: 'idle' | 'preparing' | 'audio';
  closeActionSheet: () => void;
  handleAction: (mode: 'save' | 'share') => Promise<void>;
  language: 'es' | 'en';
  styles: HomeStyles;
  theme: Theme;
}) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(actionFormat)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.actionSheet}>
          <Text style={styles.actionTitle}>{t(language, 'chooseAction')}</Text>
          <Text style={styles.actionBody}>
            {actionBusy
              ? t(language, actionPhase === 'audio' ? 'audioPreparingBody' : 'downloadPreparingBody')
              : t(language, 'chooseActionBody')}
          </Text>
          {actionBusy ? (
            <View style={styles.busyPanel}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.busyText}>{t(language, 'downloadPreparingTitle')}</Text>
            </View>
          ) : (
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
          )}
          <Pressable
            accessibilityRole="button"
            disabled={actionBusy}
            onPress={closeActionSheet}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>{t(language, 'cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  styles: HomeStyles;
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
  disabledOptions = [],
  icons,
  labels,
  onChange,
  options,
  selected,
  styles,
  theme,
}: {
  disabledOptions?: T[];
  icons?: Partial<Record<T, LucideIcon>>;
  labels: Record<T, string>;
  onChange: (value: T) => void;
  options: T[];
  selected: T;
  styles: HomeStyles;
  theme: Theme;
}) {
  return (
    <View style={styles.segmentShell}>
      {options.map((option) => {
        const Icon = icons?.[option];
        const active = selected === option;
        const disabled = disabledOptions.includes(option);
        return (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segmentButton, active && styles.segmentButtonActive, disabled && styles.segmentButtonDisabled]}
          >
            {Icon ? (
              <SegmentIcon
                Icon={Icon}
                color={active ? theme.colors.onAccent : theme.colors.mutedText}
              />
            ) : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive, disabled && styles.segmentTextDisabled]}>
              {labels[option]}
            </Text>
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
  styles: HomeStyles;
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
