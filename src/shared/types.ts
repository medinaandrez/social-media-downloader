export type Language = 'es' | 'en';

export type ThemePreference = 'system' | 'light' | 'dark';

export type PlatformId = 'twitter' | 'instagram' | 'facebook' | 'tiktok' | 'youtube';

export type MediaKind = 'video' | 'audio';

export type Quality = 'high' | 'medium' | 'low';

export type ResolveStatus = 'ready' | 'extractor_required';

export type DownloadFormat = {
  id: string;
  kind: MediaKind;
  quality: Quality;
  label: string;
  extension: string;
  mimeType: string;
  downloadUrl?: string;
  status: ResolveStatus;
};

export type ResolvedMedia = {
  id: string;
  sourceUrl: string;
  platform: PlatformId;
  title: string;
  author?: string;
  thumbnailUrl?: string;
  durationLabel?: string;
  notice?: string;
  formats: DownloadFormat[];
  resolvedAt: string;
};

export type HistoryItem = {
  id: string;
  title: string;
  sourceUrl: string;
  platform: PlatformId;
  kind: MediaKind;
  quality: Quality;
  createdAt: string;
};

export type ResolveRequest = {
  url: string;
  platform?: PlatformId;
  language?: Language;
};

export type ResolveResponse =
  | {
      ok: true;
      media: ResolvedMedia;
    }
  | {
      ok: false;
      error: string;
    };
