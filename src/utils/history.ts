import type { DownloadFormat, HistoryItem, ResolvedMedia } from '@/shared/types';

export function makeHistoryItem(media: ResolvedMedia, format: DownloadFormat): HistoryItem {
  return {
    id: `${media.id}-${format.id}-${Date.now()}`,
    title: media.title,
    sourceUrl: media.sourceUrl,
    platform: media.platform,
    kind: format.kind,
    quality: format.quality,
    createdAt: new Date().toISOString(),
  };
}
