import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useAppState } from '@/context/AppState';
import { t } from '@/i18n/translations';
import { downloadResolvedFormat } from '@/services/downloads';
import { resolveMedia } from '@/services/resolver';
import { detectPlatform } from '@/shared/platforms';
import type { DownloadFormat, MediaKind, PlatformId, ResolvedMedia } from '@/shared/types';
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
  type ActionPhase,
} from './home-screen.helpers';

export function useHomeScreenState() {
  const { addHistory, history, language, theme } = useAppState();

  const [url, setUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | 'auto'>('auto');
  const [selectedKind, setSelectedKind] = useState<MediaKind>('video');
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionFormat, setActionFormat] = useState<DownloadFormat | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionPhase, setActionPhase] = useState<ActionPhase>('idle');

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
    } catch {
      Alert.alert(t(language, 'clipboardBlockedTitle'), t(language, 'clipboardBlockedBody'));
    }
  }

  function handlePlatformChange(platform: PlatformId | 'auto') {
    setSelectedPlatform(platform);
    setResolved(null);
    setSelectedFormatId(null);
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setResolved(null);
    setSelectedFormatId(null);
    setSelectedPlatform('auto');
  }

  async function handleResolve() {
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
      setSelectedPlatform(detectPlatform(cleanUrl) ? 'auto' : media.platform);
      const preferred = pickPreferredDownloadableFormat(media.formats, selectedKind);
      if (preferred) {
        setSelectedKind(preferred.kind);
        setSelectedFormatId(preferred.id);
      } else {
        const nextFormat = firstDownloadableFormat(media.formats);
        if (nextFormat) {
          setSelectedKind(nextFormat.kind);
          setSelectedFormatId(nextFormat.id);
        } else {
          setSelectedFormatId(null);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'genericError');
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

    setActionBusy(true);
    setActionPhase(isGeneratedAudio(resolved, actionFormat) ? 'audio' : 'preparing');
    try {
      await downloadResolvedFormat({ media: resolved, format: actionFormat, mode, language });
      await addHistory(makeHistoryItem(resolved, actionFormat));
      setActionFormat(null);
      setActionPhase('idle');
      Alert.alert(t(language, 'doneTitle'), doneMessageFor(mode, language));
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'genericError');
      Alert.alert(t(language, 'downloadErrorTitle'), message);
    } finally {
      setActionBusy(false);
    }
  }

  function closeActionSheet() {
    setActionPhase('idle');
    setActionFormat(null);
  }

  return {
    actionBusy,
    actionFormat,
    actionPhase,
    canShowPreviewButton,
    copyFromClipboard,
    disabledMediaKinds,
    handleAction,
    handleOpenActions,
    handlePlatformChange,
    handleResolve,
    handleUrlChange,
    hasValidLink,
    history,
    language,
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
  };
}
