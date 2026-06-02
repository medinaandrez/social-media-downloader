import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useAppState } from '@/context/AppState';
import { t } from '@/i18n/translations';
import { trackAnalyticsEvent } from '@/services/analytics';
import { downloadResolvedFormat } from '@/services/downloads';
import { resolveMedia } from '@/services/resolver';
import { detectPlatform } from '@/shared/platforms';
import type { DownloadFormat, FailureReport, HistoryItem, MediaKind, PlatformId, Quality, ResolvedMedia } from '@/shared/types';
import { makeHistoryItem } from '@/utils/history';

import {
  doneMessageFor,
  firstDownloadableFormat,
  hasDownloadableFormat,
  isDownloadableFormat,
  isGeneratedAudio,
  mediaKinds,
  pickPreferredDownloadableFormat,
  readClipboardText,
  writeClipboardText,
  type ActionPhase,
} from './home-screen.helpers';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type FlowPhase = 'idle' | 'resolving' | 'ready' | 'preparing' | 'started' | 'error';

type ClipboardSuggestion = {
  platform: PlatformId;
  url: string;
};

export function useHomeScreenState() {
  const { addFailureReport, addHistory, history, language, removeHistoryItem, theme } = useAppState();

  const [url, setUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | 'auto'>('auto');
  const [selectedKind, setSelectedKind] = useState<MediaKind>('video');
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [clipboardSuggestion, setClipboardSuggestion] = useState<ClipboardSuggestion | null>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('idle');
  const [installCardDismissed, setInstallCardDismissed] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [lastFailure, setLastFailure] = useState<FailureReport | null>(null);
  const [webInstallAvailable, setWebInstallAvailable] = useState(false);
  const [actionFormat, setActionFormat] = useState<DownloadFormat | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionPhase, setActionPhase] = useState<ActionPhase>('idle');

  useEffect(() => {
    let mounted = true;

    async function suggestClipboardLink() {
      try {
        const copiedText = await readClipboardText();
        const cleanText = copiedText.trim();
        const platform = detectPlatform(cleanText);
        if (mounted && cleanText && platform) {
          setClipboardSuggestion({ platform, url: cleanText });
        }
      } catch {
        // Clipboard reads can be blocked on web unless triggered by a user gesture.
      }
    }

    suggestClipboardLink();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    setWebInstallAvailable(!isStandaloneWebApp());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setWebInstallAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const selectedFormat = useMemo(() => {
    const formats = resolved?.formats ?? [];
    return formats.find((format) => format.id === selectedFormatId && format.kind === selectedKind && isDownloadableFormat(format))
      ?? pickPreferredDownloadableFormat(formats, selectedKind);
  }, [resolved, selectedFormatId, selectedKind]);

  const visibleFormats = useMemo(
    () => (resolved?.formats ?? []).filter((format) => format.kind === selectedKind && isDownloadableFormat(format)),
    [resolved, selectedKind],
  );

  const disabledMediaKinds = useMemo(
    () => resolved
      ? mediaKinds.filter((kind) => !hasDownloadableFormat(resolved.formats, kind))
      : [],
    [resolved],
  );

  const detectedPlatform = useMemo(() => detectPlatform(url), [url]);
  const effectivePlatform = selectedPlatform === 'auto' ? detectedPlatform : selectedPlatform;
  const hasValidLink = Boolean(url.trim() && effectivePlatform);
  const canShowPreviewButton = hasValidLink || loading;
  const canShowInstallCard = Platform.OS === 'web' && webInstallAvailable && !installCardDismissed;

  async function copyFromClipboard() {
    try {
      const copiedText = await readClipboardText();
      const cleanText = copiedText.trim();
      if (!cleanText) {
        Alert.alert(t(language, 'clipboardEmptyTitle'), t(language, 'clipboardEmptyBody'));
        return;
      }

      setUrl(cleanText);
      setResolved(null);
      setSelectedFormatId(null);
      setSelectedPlatform('auto');
      setClipboardSuggestion(null);
      setFlowPhase('idle');
      setLastFailure(null);
    } catch {
      Alert.alert(t(language, 'clipboardBlockedTitle'), t(language, 'clipboardBlockedBody'));
    }
  }

  function applyClipboardSuggestion() {
    if (!clipboardSuggestion) {
      return;
    }

    setUrl(clipboardSuggestion.url);
    setResolved(null);
    setSelectedFormatId(null);
    setSelectedPlatform('auto');
    setClipboardSuggestion(null);
    setFlowPhase('idle');
    setLastFailure(null);
  }

  function handlePlatformChange(platform: PlatformId | 'auto') {
    setSelectedPlatform(platform);
    setResolved(null);
    setSelectedFormatId(null);
    setFlowPhase('idle');
    setLastFailure(null);
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setResolved(null);
    setSelectedFormatId(null);
    setSelectedPlatform('auto');
    setFlowPhase('idle');
    setLastFailure(null);
  }

  async function handleResolve() {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      Alert.alert(t(language, 'missingUrlTitle'), t(language, 'missingUrlBody'));
      return;
    }

    const startedAt = Date.now();
    setLoading(true);
    setFlowPhase('resolving');
    setLastFailure(null);
    await trackAnalyticsEvent({
      event: 'resolve_start',
      platform: selectedPlatform === 'auto' ? 'auto' : selectedPlatform,
      kind: selectedKind,
      language,
    });
    try {
      await resolveAndApply(cleanUrl, selectedPlatform === 'auto' ? undefined : selectedPlatform, selectedKind);
      await trackAnalyticsEvent({
        event: 'resolve_success',
        platform: effectivePlatform ?? 'unknown',
        kind: selectedKind,
        language,
        status: 'ok',
        durationMs: Date.now() - startedAt,
      });
      setFlowPhase('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'genericError');
      await trackAnalyticsEvent({
        event: 'resolve_error',
        platform: effectivePlatform ?? 'unknown',
        kind: selectedKind,
        language,
        status: 'error',
        errorType: normalizeErrorType(message),
        durationMs: Date.now() - startedAt,
      });
      setLastFailure(makeFailureReport(cleanUrl, effectivePlatform ?? undefined, message));
      setFlowPhase('error');
      Alert.alert(t(language, 'resolveErrorTitle'), message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenActions() {
    if (resolved && selectedFormat) {
      setActionPhase('idle');
      setActionFormat(selectedFormat);
    }
  }

  async function handleAction(mode: 'save' | 'share') {
    if (!resolved || !actionFormat) {
      return;
    }

    const startedAt = Date.now();
    await trackAnalyticsEvent({
      event: 'download_start',
      platform: resolved.platform,
      kind: actionFormat.kind,
      language,
    });
    setActionBusy(true);
    setActionPhase(isGeneratedAudio(resolved, actionFormat) ? 'audio' : 'preparing');
    setFlowPhase('preparing');
    setLastFailure(null);
    try {
      await downloadResolvedFormat({ media: resolved, format: actionFormat, mode, language });
      await addHistory(makeHistoryItem(resolved, actionFormat));
      await trackAnalyticsEvent({
        event: 'download_success',
        platform: resolved.platform,
        kind: actionFormat.kind,
        language,
        status: 'ok',
        durationMs: Date.now() - startedAt,
      });
      setActionFormat(null);
      setActionPhase('idle');
      setFlowPhase('started');
      Alert.alert(t(language, 'doneTitle'), doneMessageFor(mode, language));
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'genericError');
      await trackAnalyticsEvent({
        event: 'download_error',
        platform: resolved.platform,
        kind: actionFormat.kind,
        language,
        status: 'error',
        errorType: normalizeErrorType(message),
        durationMs: Date.now() - startedAt,
      });
      setLastFailure(makeFailureReport(resolved.sourceUrl, resolved.platform, message));
      setFlowPhase('error');
      Alert.alert(t(language, 'downloadErrorTitle'), message);
    } finally {
      setActionBusy(false);
    }
  }

  function closeActionSheet() {
    setActionPhase('idle');
    setActionFormat(null);
  }

  async function handleCopyFailureReport(report = lastFailure) {
    if (!report) {
      return;
    }

    await writeClipboardText(formatFailureReport(report));
    Alert.alert(t(language, 'reportCopiedTitle'), t(language, 'reportCopiedBody'));
  }

  async function handleCopyHistoryLink(item: HistoryItem) {
    await writeClipboardText(item.sourceUrl);
    Alert.alert(t(language, 'linkCopiedTitle'), t(language, 'linkCopiedBody'));
  }

  async function handleDeleteHistoryItem(item: HistoryItem) {
    await removeHistoryItem(item.id);
  }

  async function handleHistoryRedownload(item: HistoryItem) {
    setUrl(item.sourceUrl);
    setSelectedKind(item.kind);
    setSelectedPlatform('auto');
    setSelectedFormatId(null);
    setResolved(null);
    setLoading(true);
    setFlowPhase('resolving');
    setLastFailure(null);

    try {
      const { preferred } = await resolveAndApply(item.sourceUrl, item.platform, item.kind, item.quality);
      setFlowPhase('ready');
      if (preferred) {
        setActionPhase('idle');
        setActionFormat(preferred);
      } else {
        Alert.alert(t(language, 'formatUnavailable'), t(language, 'historyReplayUnavailable'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'genericError');
      setLastFailure(makeFailureReport(item.sourceUrl, item.platform, message));
      setFlowPhase('error');
      Alert.alert(t(language, 'resolveErrorTitle'), message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInstallApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice?.catch(() => undefined);
      setInstallPrompt(null);
      setInstallCardDismissed(true);
      return;
    }

    Alert.alert(t(language, 'installInstructionsTitle'), t(language, 'installInstructionsBody'));
  }

  async function handleReportFailure(report = lastFailure) {
    if (!report) {
      return;
    }

    await addFailureReport(report);
    await writeClipboardText(formatFailureReport(report));
    Alert.alert(t(language, 'reportSavedTitle'), t(language, 'reportSavedBody'));
  }

  async function handleRetryResolve() {
    await handleResolve();
  }

  async function resolveAndApply(
    cleanUrl: string,
    platform: PlatformId | undefined,
    preferredKind: MediaKind,
    preferredQuality?: Quality,
  ) {
    const media = await resolveMedia({
      url: cleanUrl,
      platform,
      language,
    });
    setResolved(media);
    setSelectedPlatform(detectPlatform(cleanUrl) ? 'auto' : media.platform);

    const preferred = preferredQuality
      ? media.formats.find((format) => (
        format.kind === preferredKind
        && format.quality === preferredQuality
        && isDownloadableFormat(format)
      )) ?? pickPreferredDownloadableFormat(media.formats, preferredKind)
      : pickPreferredDownloadableFormat(media.formats, preferredKind);

    if (preferred) {
      setSelectedKind(preferred.kind);
      setSelectedFormatId(preferred.id);
      return { media, preferred };
    }

    const nextFormat = firstDownloadableFormat(media.formats);
    if (nextFormat) {
      setSelectedKind(nextFormat.kind);
      setSelectedFormatId(nextFormat.id);
      return { media, preferred: nextFormat };
    }

    setSelectedKind(preferredKind);
    setSelectedFormatId(null);
    return { media, preferred: null };
  }

  return {
    actionBusy,
    actionFormat,
    actionPhase,
    applyClipboardSuggestion,
    canShowPreviewButton,
    canShowInstallCard,
    copyFromClipboard,
    clipboardSuggestion,
    disabledMediaKinds,
    flowPhase,
    handleAction,
    handleCopyFailureReport,
    handleCopyHistoryLink,
    handleDeleteHistoryItem,
    handleHistoryRedownload,
    handleInstallApp,
    handleOpenActions,
    handlePlatformChange,
    handleReportFailure,
    handleRetryResolve,
    handleResolve,
    handleUrlChange,
    hasValidLink,
    history,
    language,
    lastFailure,
    loading,
    effectivePlatform,
    resolved,
    selectedFormat: selectedFormat ?? null,
    selectedFormatId,
    selectedKind,
    selectedPlatform,
    setSelectedFormatId,
    setSelectedKind,
    theme,
    url,
    visibleFormats,
    closeActionSheet,
    dismissClipboardSuggestion: () => setClipboardSuggestion(null),
    dismissInstallCard: () => setInstallCardDismissed(true),
  };
}

function normalizeErrorType(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('anti-bot') || normalized.includes('not a bot')) {
    return 'youtube_antibot';
  }
  if (normalized.includes('too long') || normalized.includes('timeout') || normalized.includes('tardo demasiado')) {
    return 'timeout';
  }
  if (normalized.includes('login') || normalized.includes('iniciar sesion')) {
    return 'login_required';
  }
  return 'generic';
}

function formatFailureReport(report: FailureReport) {
  return [
    'Social Media Downloader failure report',
    `URL: ${report.url}`,
    `Platform: ${report.platform ?? 'unknown'}`,
    `Message: ${report.message}`,
    `Created: ${report.createdAt}`,
  ].join('\n');
}

function isStandaloneWebApp() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || standaloneNavigator.standalone);
}

function makeFailureReport(url: string, platform: PlatformId | undefined, message: string): FailureReport {
  return {
    id: `failure-${Date.now()}`,
    url,
    platform,
    message,
    createdAt: new Date().toISOString(),
  };
}
