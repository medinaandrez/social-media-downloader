import type { DownloadFormat, HistoryItem, HistoryStatus, PlatformId, ResolvedMedia } from '@/shared/types';

type HistoryEntryInput = {
  sourceUrl: string;
  title: string;
  platform: PlatformId | 'unknown';
  kind: HistoryItem['kind'];
  quality: HistoryItem['quality'];
  status: HistoryStatus;
  statusDetail?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function makeHistoryItem(media: ResolvedMedia, format: DownloadFormat, status: HistoryStatus = 'downloaded'): HistoryItem {
  return makeHistoryEntry({
    sourceUrl: media.sourceUrl,
    title: media.title,
    platform: media.platform,
    kind: format.kind,
    quality: format.quality,
    status,
  });
}

export function makeHistoryLinkItem(entry: HistoryEntryInput): HistoryItem {
  return makeHistoryEntry(entry);
}

function makeHistoryEntry(entry: HistoryEntryInput): HistoryItem {
  const now = entry.updatedAt ?? new Date().toISOString();
  return {
    id: `${entry.sourceUrl}-${entry.status}-${Date.now()}`,
    title: entry.title,
    sourceUrl: entry.sourceUrl,
    platform: entry.platform,
    kind: entry.kind,
    quality: entry.quality ?? null,
    status: entry.status,
    statusDetail: entry.statusDetail,
    createdAt: entry.createdAt ?? now,
    updatedAt: now,
  };
}
