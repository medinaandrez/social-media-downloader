import type { ResolveRequest, ResolveResponse } from '../src/shared/types';

type DedicatedYouTubeServiceConfig = {
  endpoint: string;
  token?: string;
  timeoutMs: number;
};

export function readDedicatedYouTubeServiceConfig(): DedicatedYouTubeServiceConfig | null {
  const rawEndpoint = process.env.YOUTUBE_RESOLVE_SERVICE_URL?.trim();
  if (!rawEndpoint) {
    return null;
  }

  const endpoint = normalizeEndpoint(rawEndpoint);
  if (!endpoint) {
    return null;
  }

  const token = process.env.YOUTUBE_RESOLVE_SERVICE_TOKEN?.trim() || undefined;
  const timeoutMs = clampTimeout(Number(process.env.YOUTUBE_RESOLVE_SERVICE_TIMEOUT_MS || 30000));

  return { endpoint, token, timeoutMs };
}

export async function resolveWithDedicatedYouTubeService(
  body: Partial<ResolveRequest>,
  config: DedicatedYouTubeServiceConfig,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await readJson(response) as ResolveResponse;

    if (!isResolveResponse(payload)) {
      throw new Error('Dedicated YouTube service returned an invalid payload');
    }

    return {
      status: response.status,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeEndpoint(value: string) {
  if (!value) {
    return null;
  }

  const trimmed = value.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/resolve')) {
    return trimmed;
  }

  return `${trimmed}/api/resolve`;
}

function clampTimeout(value: number) {
  if (!Number.isFinite(value)) {
    return 30000;
  }

  return Math.max(3000, Math.min(60000, Math.round(value)));
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function isResolveResponse(value: unknown): value is ResolveResponse {
  if (!value || typeof value !== 'object' || !('ok' in value)) {
    return false;
  }

  const candidate = value as { ok?: unknown; error?: unknown; media?: unknown };
  return typeof candidate.ok === 'boolean'
    && (candidate.ok ? Boolean(candidate.media) : typeof candidate.error === 'string');
}
