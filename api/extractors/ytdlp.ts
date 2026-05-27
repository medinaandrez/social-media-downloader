import { existsSync } from 'node:fs';
import { join } from 'node:path';

import youtubeDl, { create as createYoutubeDl } from 'youtube-dl-exec';
import type { Flags, Format, Payload } from 'youtube-dl-exec';

import { hasOptionalYouTubeCookies, withOptionalYouTubeCookies } from '../ytdlp-auth';
import { createExtractorRequiredFormats } from '../../src/shared/format-presets';
import type { DownloadFormat, Language, PlatformId, ResolvedMedia } from '../../src/shared/types';

type ExtractParams = {
  url: string;
  language: Language;
  platform: ExtractablePlatform;
};

type ExtractablePlatform = Extract<PlatformId, 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'youtube'>;
type YtDlpJsRuntime = 'node' | 'bun' | 'quickjs' | 'deno' | `${'node' | 'bun' | 'quickjs' | 'deno'}:${string}`;
type YtDlpFlags = Flags & { extractorArgs?: string };

const localBinaryPath = join(process.cwd(), '.bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

const runner = process.env.YTDLP_PATH
  ? createYoutubeDl(process.env.YTDLP_PATH)
  : existsSync(localBinaryPath)
    ? createYoutubeDl(localBinaryPath)
    : youtubeDl;

export async function extractWithYtDlp({ url, language, platform }: ExtractParams): Promise<ResolvedMedia> {
  const payload = await runYtDlp({ url, platform });

  const sourceUrl = payload.webpage_url || url;
  const formats = mapFormats(payload.formats ?? [], language, platform, sourceUrl);
  const fallbackNotice = shouldUseTwitterReplayExtraction(platform, sourceUrl)
    ? twitterReplayNotice(language)
    : noticeFallback(language, platform);

  return {
    id: payload.id || `${payload.extractor_key}-${Date.now()}`,
    sourceUrl,
    platform,
    title: payload.title || titleFallback(language, platform),
    author: payload.uploader || payload.channel || undefined,
    thumbnailUrl: payload.thumbnail || payload.thumbnails?.at(-1)?.url,
    durationLabel: formatDuration(payload.duration),
    notice: formats.some((format) => format.downloadUrl) ? undefined : fallbackNotice,
    formats: formats.length > 0 ? formats : createExtractorRequiredFormats(language, 'video-only'),
    resolvedAt: new Date().toISOString(),
  };
}

async function runYtDlp({ url, platform }: Pick<ExtractParams, 'url' | 'platform'>): Promise<Payload> {
  const maxAttempts = platform === 'instagram' ? 3 : platform === 'youtube' ? 3 : 1;
  const timeoutMs = extractionTimeoutFor(platform);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runYtDlpRequest(url, timeoutMs);
    } catch (error) {
      let nextError = error;

      if (platform === 'youtube' && shouldTryYouTubeCookiesFallback(error) && hasOptionalYouTubeCookies()) {
        try {
          const payload = await withOptionalYouTubeCookies(platform, async (cookiesPath) => (
            await runYtDlpRequest(url, timeoutMs, cookiesPath)
          ));

          if (hasUsableYouTubeFormats(payload)) {
            return payload;
          }

          console.warn('youtube cookies fallback returned only storyboard or non-downloadable formats');
        } catch (cookieError) {
          console.warn('youtube cookies fallback failed', cookieError);
        }
      }

      if (!shouldRetryYtDlp(platform, nextError, attempt, maxAttempts)) {
        throw nextError;
      }

      console.warn(`${platform} extraction retry ${attempt}/${maxAttempts - 1}`);
      await wait(retryDelayMsFor(platform, attempt));
    }
  }

  throw new Error(`${platform} extraction failed`);
}

async function runYtDlpRequest(url: string, timeoutMs: number, cookiesPath?: string) {
  const flags: YtDlpFlags = {
    ...(cookiesPath ? { cookies: cookiesPath } : {}),
    dumpSingleJson: true,
    extractorArgs: ytDlpExtractorArgs(),
    forceIpv4: true,
    noPlaylist: true,
    noWarnings: true,
    retries: 1,
    quiet: true,
    jsRuntimes: ytDlpJsRuntime(),
    socketTimeout: 15,
    skipDownload: true,
  };

  return await runner(url, flags, {
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  }) as Payload;
}

function shouldRetryYtDlp(
  platform: ExtractablePlatform,
  error: unknown,
  attempt: number,
  maxAttempts: number,
) {
  if (platform !== 'instagram' || attempt >= maxAttempts) {
    if (platform !== 'youtube' || attempt >= maxAttempts) {
      return false;
    }
  }

  const details = errorDetails(error);
  if (platform === 'instagram') {
    return isInstagramAnonymousAccessError(details) || isTransientInstagramError(details);
  }

  return isTransientYouTubeError(details);
}

function extractionTimeoutFor(platform: ExtractablePlatform) {
  if (platform === 'youtube') {
    const configured = Number(process.env.YTDLP_YOUTUBE_TIMEOUT_MS || 45000);
    if (Number.isFinite(configured)) {
      return Math.max(10000, Math.min(120000, Math.round(configured)));
    }

    return 45000;
  }

  return 30000;
}

function ytDlpJsRuntime(): YtDlpJsRuntime {
  const configured = process.env.YTDLP_JS_RUNTIMES?.trim();
  return isSupportedJsRuntime(configured) ? configured : 'node';
}

function ytDlpExtractorArgs() {
  return process.env.YTDLP_EXTRACTOR_ARGS?.trim() || 'youtube:player_client=mweb,default';
}

function isSupportedJsRuntime(value: string | undefined): value is YtDlpJsRuntime {
  return Boolean(value && /^(node|bun|quickjs|deno)(:.+)?$/.test(value));
}

function shouldTryYouTubeCookiesFallback(error: unknown) {
  const details = errorDetails(error).toLowerCase();

  return details.includes('sign in to confirm you')
    || details.includes('use --cookies-from-browser or --cookies')
    || details.includes('login')
    || details.includes('sign in')
    || details.includes('cookies');
}

function hasUsableYouTubeFormats(payload: Payload) {
  return (payload.formats ?? []).some((format) => isDownloadable(format) && (hasVideo(format) || hasAudio(format)));
}

function retryDelayMsFor(platform: ExtractablePlatform, attempt: number) {
  if (platform === 'youtube') {
    return 1500 * attempt;
  }

  return 650 * attempt;
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
  const progressiveVideoFormats = videoFormats.filter((format) => hasAudio(format));

  const preferredVideoPool = platform === 'youtube' && progressiveVideoFormats.length > 0
    ? progressiveVideoFormats
    : videoFormats;

  const bestVideo = preferredVideoPool.find((format) => !hasWatermark(format)) ?? preferredVideoPool[0];
  const watermarkedVideo = preferredVideoPool.find((format) => hasWatermark(format) && format.url !== bestVideo?.url);
  const compactVideo = [...preferredVideoPool].reverse().find((format) => format.url !== bestVideo?.url && format.url !== watermarkedVideo?.url);

  const audioFormats = formats
    .filter((format) => isDownloadable(format) && hasAudio(format) && !hasVideo(format))
    .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0));

  const mapped: DownloadFormat[] = [];

  if (bestVideo) {
    mapped.push(toDownloadFormat(bestVideo, {
      id: 'video-high',
      label: videoLabel(language, platform, 'high'),
      quality: 'high',
      downloadUrl: usesVideoExtraction(platform) ? videoExtractionUrl(sourceUrl, 'high') : undefined,
      extension: usesVideoExtraction(platform) ? 'mp4' : undefined,
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
      downloadUrl: usesVideoExtraction(platform) ? videoExtractionUrl(sourceUrl, 'low') : undefined,
      extension: usesVideoExtraction(platform) ? 'mp4' : undefined,
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

  if (mapped.length === 0 && shouldUseTwitterReplayExtraction(platform, sourceUrl)) {
    mapped.push(
      {
        id: 'video-high',
        kind: 'video',
        quality: 'high',
        label: language === 'es' ? 'Video alta - preparar' : 'High video - prepare',
        extension: 'mp4',
        mimeType: 'video/mp4',
        downloadUrl: videoExtractionUrl(sourceUrl, 'high'),
        status: 'ready',
      },
      {
        id: 'video-low',
        kind: 'video',
        quality: 'low',
        label: language === 'es' ? 'Video ligero - preparar' : 'Light video - prepare',
        extension: 'mp4',
        mimeType: 'video/mp4',
        downloadUrl: videoExtractionUrl(sourceUrl, 'low'),
        status: 'ready',
      },
    );
  }

  return mapped;
}

function audioExtractionUrl(sourceUrl: string) {
  const params = new URLSearchParams({ url: sourceUrl });
  return `/api/audio?${params.toString()}`;
}

function videoExtractionUrl(sourceUrl: string, quality: 'high' | 'low') {
  const params = new URLSearchParams({ url: sourceUrl, quality });
  return `/api/video?${params.toString()}`;
}

function usesVideoExtraction(platform: ExtractablePlatform) {
  return platform === 'facebook' || platform === 'instagram';
}

function shouldUseTwitterReplayExtraction(platform: ExtractablePlatform, sourceUrl: string) {
  return platform === 'twitter' && /:\/\/(?:www\.)?(?:x|twitter)\.com\/i\/broadcasts\//i.test(sourceUrl);
}

function toDownloadFormat(
  format: Format,
  options: {
    id: string;
    label: string;
    quality: DownloadFormat['quality'];
    kind?: DownloadFormat['kind'];
    downloadUrl?: string;
    extension?: string;
  },
): DownloadFormat {
  const extension = normalizeExtension(options.extension ?? format.ext);

  return {
    id: options.id,
    kind: options.kind ?? 'video',
    quality: options.quality,
    label: options.label,
    extension,
    mimeType: mimeTypeFor(extension, options.kind ?? 'video'),
    downloadUrl: options.downloadUrl ?? format.url,
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

function errorDetails(error: unknown) {
  return error instanceof Error ? `${error.message} ${'stderr' in error ? String(error.stderr) : ''}` : String(error);
}

function isInstagramAnonymousAccessError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('empty media response')
    || normalized.includes('without being logged-in')
    || normalized.includes('login required');
}

function isTransientInstagramError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('please wait a few minutes')
    || normalized.includes('http error 403')
    || normalized.includes('http error 429')
    || normalized.includes('temporarily blocked');
}

function isTransientYouTubeError(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes("this content isn't available, try again later")
    || normalized.includes('sign in to confirm you’re not a bot')
    || normalized.includes("sign in to confirm you're not a bot")
    || normalized.includes('too many requests')
    || normalized.includes('http error 429');
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
      facebook: 'Video publico de Facebook',
      tiktok: 'Video publico de TikTok',
      twitter: 'Video publico de Twitter',
      instagram: 'Video publico de Instagram',
      youtube: 'Video publico de YouTube',
    },
    en: {
      facebook: 'Facebook public video',
      tiktok: 'TikTok public video',
      twitter: 'Twitter public video',
      instagram: 'Instagram public video',
      youtube: 'YouTube public video',
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

function twitterReplayNotice(language: Language) {
  return language === 'es'
    ? 'Este replay de X necesita prepararse antes de descargarlo. Puede tardar un poco mas que un video normal.'
    : 'This X replay needs to be prepared before downloading. It may take a bit longer than a regular video.';
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function platformLabel(platform: ExtractablePlatform) {
  switch (platform) {
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    case 'twitter':
      return 'Twitter';
    case 'youtube':
      return 'YouTube';
  }
}
