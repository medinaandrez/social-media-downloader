import type { Language, ResolvedMedia } from '../shared/types';

const actorId = process.env.APIFY_YOUTUBE_ACTOR_ID?.trim() || 'marielise.dev~youtube-video-downloader';
const maxChargeUsd = 0.5;
const runWaitSeconds = 55;
const timeoutMs = 57_000;

type ApifyDatasetItem = {
  error?: unknown;
  status?: unknown;
  title?: unknown;
  videoId?: unknown;
  uploader?: unknown;
  duration?: unknown;
  originalUrl?: unknown;
  downloadUrl?: unknown;
  deliveredQuality?: unknown;
};

type ApifyRunResponse = {
  data?: {
    status?: unknown;
    defaultDatasetId?: unknown;
  };
};

export function isApifyYouTubeConfigured() {
  return Boolean(process.env.APIFY_API_TOKEN?.trim());
}

export async function resolveWithApifyYouTube(url: string, language: Language): Promise<ResolvedMedia> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    throw new ApifyYouTubeError('Apify YouTube is not configured', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const runUrl = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`);
    runUrl.searchParams.set('waitForFinish', String(runWaitSeconds));
    runUrl.searchParams.set('maxTotalChargeUsd', String(maxChargeUsd));

    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [{ url }],
        quality: '720',
        format: 'default',
        residentialProxyMode: 'disabled',
      }),
      signal: controller.signal,
    });
    const runPayload = await readJson<ApifyRunResponse>(runResponse);

    if (!runResponse.ok) {
      throw new ApifyYouTubeError('Apify could not start the YouTube download', 502);
    }

    const run = runPayload.data;
    if (run?.status !== 'SUCCEEDED' || typeof run.defaultDatasetId !== 'string') {
      throw new ApifyYouTubeError('YouTube took too long to prepare this video. Try again later.', 504);
    }

    const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${encodeURIComponent(run.defaultDatasetId)}/items`);
    datasetUrl.searchParams.set('format', 'json');
    datasetUrl.searchParams.set('clean', 'true');

    const datasetResponse = await fetch(datasetUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const items = await readJson<ApifyDatasetItem[]>(datasetResponse);
    if (!datasetResponse.ok || !Array.isArray(items)) {
      throw new ApifyYouTubeError('Could not read the YouTube download result', 502);
    }

    const item = items.find(isSuccessfulVideo);
    if (!item || typeof item.downloadUrl !== 'string' || !isSafeDownloadUrl(item.downloadUrl)) {
      const failed = items.find((candidate) => candidate.status === 'failed');
      const error = typeof failed?.error === 'string' ? failed.error : '';
      throw new ApifyYouTubeError(publicFailureMessage(error, language), 422);
    }

    const title = typeof item.title === 'string' && item.title.trim()
      ? item.title.trim()
      : language === 'es' ? 'Video de YouTube' : 'YouTube video';
    const deliveredQuality = typeof item.deliveredQuality === 'string' ? item.deliveredQuality : '720p';

    return {
      id: typeof item.videoId === 'string' ? item.videoId : new URL(url).searchParams.get('v') || 'youtube-video',
      sourceUrl: typeof item.originalUrl === 'string' ? item.originalUrl : url,
      platform: 'youtube',
      title,
      author: typeof item.uploader === 'string' ? item.uploader : undefined,
      durationLabel: formatDuration(item.duration),
      notice: undefined,
      formats: [
        {
          id: 'video-high',
          kind: 'video',
          quality: 'high',
          label: language === 'es' ? `Video ${deliveredQuality}` : `Video ${deliveredQuality}`,
          extension: 'mp4',
          mimeType: 'video/mp4',
          downloadUrl: item.downloadUrl,
          status: 'ready',
        },
        {
          id: 'audio-high',
          kind: 'audio',
          quality: 'high',
          label: language === 'es' ? 'Audio requiere conversion' : 'Audio requires conversion',
          extension: 'm4a',
          mimeType: 'audio/mp4',
          status: 'extractor_required',
        },
      ],
      resolvedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof ApifyYouTubeError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApifyYouTubeError('YouTube took too long to prepare this video. Try again later.', 504);
    }
    throw new ApifyYouTubeError('YouTube could not provide this video right now. Try again later.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

export class ApifyYouTubeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new ApifyYouTubeError('Apify returned an invalid response', 502);
  }
}

function isSuccessfulVideo(item: ApifyDatasetItem): item is ApifyDatasetItem & { downloadUrl: string } {
  return item.status === 'success'
    && typeof item.downloadUrl === 'string'
    && isSafeDownloadUrl(item.downloadUrl);
}

function isSafeDownloadUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'api.apify.com';
  } catch {
    return false;
  }
}

function publicFailureMessage(details: string, language: Language) {
  const normalized = details.toLowerCase();
  if (normalized.includes('private') || normalized.includes('age-restricted')) {
    return language === 'es'
      ? 'Este video es privado o tiene restriccion de edad y no se puede descargar.'
      : 'This video is private or age-restricted and cannot be downloaded.';
  }
  if (normalized.includes('not available') || normalized.includes('unavailable') || normalized.includes('removed')) {
    return language === 'es'
      ? 'YouTube no tiene disponible este video. Verifica el enlace e intenta otro video publico.'
      : 'YouTube does not have this video available. Check the link and try another public video.';
  }
  return language === 'es'
    ? 'No se pudo preparar este video de YouTube. Puede ser una restriccion temporal o un video demasiado largo.'
    : 'Could not prepare this YouTube video. It may be temporarily restricted or too long.';
}

function formatDuration(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const seconds = Math.max(0, Math.floor(value));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  if (typeof value === 'string' && /^\d+(?::\d{1,2}){0,2}$/.test(value)) {
    const parts = value.split(':');
    return parts.length === 1 ? `0:${parts[0].padStart(2, '0')}` : value;
  }
  return undefined;
}
