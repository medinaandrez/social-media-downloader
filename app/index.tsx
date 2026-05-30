import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionSheet,
  EmptyStateCard,
  HistorySection,
  HomeHeader,
  LinkPanel,
  MediaKindControl,
  PreviewCard,
  PublicNoticeStrip,
} from '@/features/home/home-screen.components';
import { makeHomeStyles } from '@/features/home/home-screen.styles';
import { useHomeScreenState } from '@/features/home/use-home-screen-state';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 720;

  const state = useHomeScreenState();
  const styles = useMemo(() => makeHomeStyles(state.theme, isCompact), [isCompact, state.theme]);

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
        <HomeHeader language={state.language} styles={styles} theme={state.theme} />

        <LinkPanel
          canShowPreviewButton={state.canShowPreviewButton}
          copyFromClipboard={state.copyFromClipboard}
          handlePlatformChange={state.handlePlatformChange}
          handleResolve={state.handleResolve}
          handleUrlChange={state.handleUrlChange}
          language={state.language}
          loading={state.loading}
          effectivePlatform={state.effectivePlatform}
          selectedPlatform={state.selectedPlatform}
          styles={styles}
          theme={state.theme}
          url={state.url}
        />

        {state.hasValidLink ? (
          <MediaKindControl
            disabledMediaKinds={state.disabledMediaKinds}
            language={state.language}
            onChange={(kind) => {
              state.setSelectedKind(kind);
              state.setSelectedFormatId(null);
            }}
            selectedKind={state.selectedKind}
            styles={styles}
            theme={state.theme}
          />
        ) : null}

        {state.resolved ? (
          <PreviewCard
            language={state.language}
            onDownload={state.handleOpenActions}
            onSelectFormat={state.setSelectedFormatId}
            resolved={state.resolved}
            selectedFormat={state.selectedFormat}
            styles={styles}
            theme={state.theme}
            visibleFormats={state.visibleFormats}
          />
        ) : (
          <EmptyStateCard language={state.language} styles={styles} theme={state.theme} />
        )}

        <PublicNoticeStrip language={state.language} styles={styles} theme={state.theme} />

        <HistorySection
          history={state.history}
          language={state.language}
          styles={styles}
          theme={state.theme}
        />
      </ScrollView>

      <ActionSheet
        actionBusy={state.actionBusy}
        actionFormat={state.actionFormat}
        actionPhase={state.actionPhase}
        closeActionSheet={state.closeActionSheet}
        handleAction={state.handleAction}
        language={state.language}
        styles={styles}
        theme={state.theme}
      />
    </KeyboardAvoidingView>
  );
}
