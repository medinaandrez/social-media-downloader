import { existsSync } from 'node:fs';
import { join } from 'node:path';

import youtubeDl, { create as createYoutubeDl } from 'youtube-dl-exec';
import type { Format, Payload } from 'youtube-dl-exec';

import type { DownloadFormat, Language, PlatformId, ResolvedMedia } from '../../src/shared/types';

type ExtractParams = {
  url: string;
  language: Language;
  platform: ExtractablePlatform;
};

type ExtractablePlatform = Extract<PlatformId, 'instagram' | 'tiktok' | 'twitter'>;

const localBinaryPath = join(process.cwd(), '.bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

const runner = process.env.YTDLP_PATH
  ? createYoutubeDl(process.env.YTDLP_PATH)
  : existsSync(localBinaryPath)
    ? createYoutubeDl(localBinaryPath)
    : youtubeDl;

export async function extractWithYtDlp({ url, language, platform }: ExtractParams): Promise<ResolvedMedia> {
  const payload = await runner(url, {
    dumpSingleJson: true,
    forceIpv4: true,
    noPlaylist: true,
    noWarnings: true,
    retries: 1,
    quiet: true,
    socketTimeout: 15,
    skipDownload: true,
  }, {
    timeout: 30000,
    killSignal: 'SIGKILL',
  }) as Payload;

  const sourceUrl = payload.webpage_url || url;
  const formats = mapFormats(payload.formats ?? [], language, platform, sourceUrl);

  return {
    id: payload.id || `${payload.extractor_key}-${Date.now()}`,
    sourceUrl,
    platform,
    title: payload.title || titleFallback(language, platform),
    author: payload.uploader || payload.channel || undefined,
    thumbnailUrl: payload.thumbnail || payload.thumbnails?.at(-1)?.url,
    durationLabel: formatDuration(payload.duration),
    notice: formats.some((format) => format.downloadUrl) ? undefined : noticeFallback(language, platform),
    formats: formats.length > 0 ? formats : createPendingFormats(language),
    resolvedAt: new Date().toISOString(),
  };
}

function mapFormats(
  formats: Format[],
  language: Language,
  platform: ExtractablePlatform,
  sourceUrl: string,
): DownloadFormat[] {
  const videoFormats = formats
    .filter((format) => isDownloadable(format) && hasVideo(format))
    .sort((a, b) => scoreVideo(b) - scoreVideo(a));

  const bestVideo = videoFormats.find((format) => !hasWatermark(format)) ?? videoFormats[0];
  const watermarkedVideo = videoFormats.find((format) => hasWatermark(format) && format.url !== bestVideo?.url);
  const compactVideo = [...videoFormats].reverse().find((format) => format.url !== bestVideo?.url && format.url !== watermarkedVideo?.url);

  const audioFormats = formats
    .filter((format) => isDownloadable(format) && hasAudio(format) && !hasVideo(format))
    .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0));

  const mapped: DownloadFormat[] = [];

  if (bestVideo) {
    mapped.push(toDownloadFormat(bestVideo, {
      id: 'video-high',
      label: videoLabel(language, platform, 'high'),
      quality: 'high',
    }));
  }

  if (platform === 'tiktok' && watermarkedVideo) {
    mapped.push(toDownloadFormat(watermarkedVideo, {
      id: 'video-high-watermark',
      label: language === 'es' ? 'Video alta - con marca' : 'High video - watermark',
      quality: 'high',
    }));
  }

  if (compactVideo) {
    mapped.push(toDownloadFormat(compactVideo, {
      id: 'video-low',
      label: videoLabel(language, platform, 'low'),
      quality: 'low',
    }));
  }

  if (audioFormats[0]) {
    mapped.push(toDownloadFormat(audioFormats[0], {
      id: 'audio-high',
      label: language === 'es' ? 'Audio alta' : 'High audio',
      quality: 'high',
      kind: 'audio',
    }));
  } else if (bestVideo && platform === 'twitter') {
    mapped.push({
      id: 'audio-high',
      kind: 'audio',
      quality: 'high',
      label: language === 'es' ? 'Audio' : 'Audio',
      extension: 'mp4',
      mimeType: 'audio/mp4',
      downloadUrl: audioExtractionUrl(sourceUrl),
      status: 'ready',
    });
  } else if (bestVideo) {
    mapped.push({
      id: 'audio-high',
      kind: 'audio',
      quality: 'high',
      label: language === 'es' ? 'Audio requiere conversion' : 'Audio requires conversion',
      extension: 'm4a',
      mimeType: 'audio/mp4',
      status: 'extractor_required',
    });
  }

  return mapped;
}

function audioExtractionUrl(sourceUrl: string) {
  const params = new URLSearchParams({ url: sourceUrl });
  return `/api/audio?${params.toString()}`;
}

function toDownloadFormat(
  format: Format,
  options: {
    id: string;
    label: string;
    quality: DownloadFormat['quality'];
    kind?: DownloadFormat['kind'];
  },
): DownloadFormat {
  const extension = normalizeExtension(format.ext);

  return {
    id: options.id,
    kind: options.kind ?? 'video',
    quality: options.quality,
    label: options.label,
    extension,
    mimeType: mimeTypeFor(extension, options.kind ?? 'video'),
    downloadUrl: format.url,
    status: 'ready',
  };
}

function isDownloadable(format: Format) {
  return Boolean(format.url) && !format.has_drm && ['https', 'http'].includes(String(format.protocol));
}

function hasVideo(format: Format) {
  return format.vcodec !== 'none' || Boolean(format.height || format.width);
}

function hasAudio(format: Format) {
  return format.acodec !== 'none' || Boolean(format.abr || format.audio_channels);
}

function hasWatermark(format: Format) {
  const searchable = `${format.format_id} ${format.format_note ?? ''} ${format.format ?? ''}`.toLowerCase();
  return searchable.includes('watermark') || searchable.includes('wm');
}

function scoreVideo(format: Format) {
  return (format.height ?? 0) * 100000 + (format.tbr ?? 0) * 100 + (format.filesize ?? format.filesize_approx ?? 0) / 1000000;
}

function normalizeExtension(extension: string) {
  return extension === 'mov' ? 'mp4' : extension || 'mp4';
}

function mimeTypeFor(extension: string, kind: DownloadFormat['kind']) {
  if (kind === 'audio') {
    return extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
  }

  return extension === 'webm' ? 'video/webm' : 'video/mp4';
}

function formatDuration(duration?: number) {
  if (!duration || !Number.isFinite(duration)) {
    return undefined;
  }

  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function createPendingFormats(language: Language): DownloadFormat[] {
  return [{
    id: 'video-high',
    kind: 'video',
    quality: 'high',
    label: language === 'es' ? 'Video pendiente' : 'Pending video',
    extension: 'mp4',
    mimeType: 'video/mp4',
    status: 'extractor_required',
  }];
}

function videoLabel(language: Language, platform: ExtractablePlatform, quality: 'high' | 'low') {
  if (platform === 'tiktok') {
    if (quality === 'high') {
      return language === 'es' ? 'Video alta - sin marca' : 'High video - no watermark';
    }
    return language === 'es' ? 'Video ligero' : 'Light video';
  }

  if (quality === 'high') {
    return language === 'es' ? 'Video alta' : 'High video';
  }
  return language === 'es' ? 'Video ligero' : 'Light video';
}

function titleFallback(language: Language, platform: ExtractablePlatform) {
  const titles = {
    es: {
      tiktok: 'Video publico de TikTok',
      twitter: 'Video publico de Twitter',
      instagram: 'Video publico de Instagram',
    },
    en: {
      tiktok: 'TikTok public video',
      twitter: 'Twitter public video',
      instagram: 'Instagram public video',
    },
  } satisfies Record<Language, Record<ExtractablePlatform, string>>;

  return titles[language][platform];
}

function noticeFallback(language: Language, platform: ExtractablePlatform) {
  const platformName = platformLabel(platform);

  return language === 'es'
    ? `No se encontro una URL descargable para este video publico de ${platformName}.`
    : `No downloadable URL was found for this public ${platformName} video.`;
}

function platformLabel(platform: ExtractablePlatform) {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    case 'twitter':
      return 'Twitter';
  }
}
