import type { Language, ResolvedMedia } from '../shared/types';

const actorId = process.env.APIFY_YOUTUBE_ACTOR_ID?.trim() || 'marielise.dev~youtube-video-downloader';
const maxChargeUsd = 0.5;
const requestTimeoutMs = 12_000;

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

type ApifyRun = {
  id?: unknown;
  status?: unknown;
  statusMessage?: unknown;
  actId?: unknown;
  defaultDatasetId?: unknown;
};

export type ApifyYouTubeJobResult =
  | { status: 'pending' }
  | { status: 'succeeded'; media: ResolvedMedia }
  | { status: 'failed'; error: string; httpStatus: number };

export function isApifyYouTubeConfigured() {
  return Boolean(process.env.APIFY_API_TOKEN?.trim());
}

export async function startApifyYouTube(url: string, language: Language): Promise<ApifyYouTubeJobResult & { runId?: string }> {
  const token = requireToken();
  const runUrl = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`);
  runUrl.searchParams.set('maxTotalChargeUsd', String(maxChargeUsd));

  const run = await fetchJson<ApifyRun>(runUrl, {
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
  });

  if (typeof run?.id !== 'string') {
    throw new ApifyYouTubeError('Apify did not return a run identifier', 502);
  }

  if (run.status === 'SUCCEEDED' && typeof run.defaultDatasetId === 'string') {
    return {
      status: 'succeeded',
      media: await readMediaFromDataset(run.defaultDatasetId, url, language),
      runId: run.id,
    };
  }

  if (isTerminalStatus(run.status)) {
    return {
      status: 'failed',
      error: terminalRunMessage(language, run.status, run.statusMessage),
      httpStatus: 422,
      runId: run.id,
    };
  }

  return { status: 'pending', runId: run.id };
}

export async function readApifyYouTubeJob(runId: string, sourceUrl: string, language: Language): Promise<ApifyYouTubeJobResult> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(runId)) {
    throw new ApifyYouTubeError('Invalid YouTube job identifier', 400);
  }

  const token = requireToken();
  const runUrl = new URL(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`);
  const run = await fetchJson<ApifyRun>(runUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (run?.actId !== actorId) {
    throw new ApifyYouTubeError('YouTube job not found', 404);
  }
  if (run.status === 'SUCCEEDED') {
    if (typeof run.defaultDatasetId !== 'string') {
      throw new ApifyYouTubeError('Apify did not return a result dataset', 502);
    }
    return {
      status: 'succeeded',
      media: await readMediaFromDataset(run.defaultDatasetId, sourceUrl, language),
    };
  }
  if (isTerminalStatus(run.status)) {
    return { status: 'failed', error: terminalRunMessage(language, run.status, run.statusMessage), httpStatus: 422 };
  }
  return { status: 'pending' };
}

export class ApifyYouTubeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readMediaFromDataset(datasetId: string, url: string, language: Language): Promise<ResolvedMedia> {
  const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`);
  datasetUrl.searchParams.set('format', 'json');
  datasetUrl.searchParams.set('clean', 'true');
  const items = await fetchJson<ApifyDatasetItem[]>(datasetUrl, {
    headers: { Authorization: `Bearer ${requireToken()}` },
  });

  if (!Array.isArray(items)) {
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
        label: `Video ${deliveredQuality}`,
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
}

async function fetchJson<T>(url: URL, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await readJson<{ data?: T } | T>(response);
    if (!response.ok) {
      throw new ApifyYouTubeError('Apify could not complete this YouTube request', response.status === 429 ? 503 : 502);
    }
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApifyYouTubeError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApifyYouTubeError('Apify status check timed out. Try again shortly.', 504);
    }
    throw new ApifyYouTubeError('Apify could not provide this video right now. Try again later.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new ApifyYouTubeError('Apify returned an invalid response', 502);
  }
}

function requireToken() {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    throw new ApifyYouTubeError('Apify YouTube is not configured', 503);
  }
  return token;
}

function isTerminalStatus(status: unknown) {
  return status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT';
}

function terminalRunMessage(language: Language, status: unknown, details: unknown) {
  const normalizedDetails = typeof details === 'string' ? details.toLowerCase() : '';
  if (normalizedDetails.includes('max total charge') || normalizedDetails.includes('charge limit')) {
    return language === 'es'
      ? 'Apify detuvo la ejecucion al alcanzar el limite de gasto de US$0.50 configurado por video.'
      : 'Apify stopped this run after reaching the US$0.50 per-video spending limit.';
  }
  if (status === 'TIMED-OUT') {
    return language === 'es'
      ? 'Apify agoto el tiempo maximo de ejecucion antes de preparar este video.'
      : 'Apify reached its maximum run time before preparing this video.';
  }
  return language === 'es'
    ? 'Apify no pudo completar este video. El Actor termino con un error.'
    : 'Apify could not finish this video. The Actor ended with an error.';
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
