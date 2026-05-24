import type { PlatformId } from './types';

export type PlatformConfig = {
  id: PlatformId;
  label: string;
  hostPatterns: RegExp[];
  pathPatterns: RegExp[];
};

export const platforms: PlatformConfig[] = [
  {
    id: 'twitter',
    label: 'Twitter',
    hostPatterns: [/^twitter\.com$/i, /^x\.com$/i, /^mobile\.twitter\.com$/i],
    pathPatterns: [/\/status\/\d+/i],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    hostPatterns: [/^instagram\.com$/i, /^www\.instagram\.com$/i],
    pathPatterns: [/\/p\//i, /\/reel\//i],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    hostPatterns: [/^facebook\.com$/i, /^www\.facebook\.com$/i, /^fb\.watch$/i, /^m\.facebook\.com$/i],
    pathPatterns: [/\/watch/i, /\/reel/i, /\/videos/i, /\/share\/r/i, /\/share\/v/i],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    hostPatterns: [/^tiktok\.com$/i, /^www\.tiktok\.com$/i, /^vm\.tiktok\.com$/i, /^vt\.tiktok\.com$/i],
    pathPatterns: [/\/video\//i, /^\/.+/i],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    hostPatterns: [/^youtube\.com$/i, /^www\.youtube\.com$/i, /^m\.youtube\.com$/i, /^youtu\.be$/i],
    pathPatterns: [/\/watch/i, /\/shorts\//i, /^\/[a-z0-9_-]{6,}$/i],
  },
];

export function detectPlatform(rawUrl: string): PlatformId | null {
  const parsed = parseUrl(rawUrl);
  if (!parsed) {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '');
  const pathname = parsed.pathname;

  if (/^fb\.watch$/i.test(host) && /^\/.+/i.test(pathname)) {
    return 'facebook';
  }

  if (/^youtu\.be$/i.test(host) && /^\/[a-z0-9_-]{6,}$/i.test(pathname)) {
    return 'youtube';
  }

  const platform = platforms.find((item) => {
    const hostMatches = item.hostPatterns.some((pattern) => pattern.test(host) || pattern.test(parsed.hostname));
    const pathMatches = item.pathPatterns.some((pattern) => pattern.test(pathname));
    return hostMatches && pathMatches;
  });

  return platform?.id ?? null;
}

export function isSupportedPublicUrl(rawUrl: string, selectedPlatform?: PlatformId) {
  const parsed = parseUrl(rawUrl);
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    return {
      ok: false as const,
      error: 'Invalid URL',
    };
  }

  const detected = detectPlatform(rawUrl);
  const platform = selectedPlatform ?? detected;

  if (!platform) {
    return {
      ok: false as const,
      error: 'Unsupported platform',
    };
  }

  if (selectedPlatform && detected && selectedPlatform !== detected) {
    return {
      ok: false as const,
      error: 'Selected platform does not match the link',
    };
  }

  return {
    ok: true as const,
    platform,
    normalizedUrl: normalizePlatformUrl(parsed, platform).toString(),
  };
}

function normalizePlatformUrl(url: URL, platform: PlatformId) {
  if (platform === 'facebook') {
    const watchPathMatch = url.pathname.match(/^\/watch\/v=(\d+)/i);
    if (watchPathMatch) {
      const normalized = new URL(url.toString());
      normalized.pathname = '/watch/';
      normalized.search = `?v=${watchPathMatch[1]}`;
      return normalized;
    }
  }

  if (platform === 'youtube') {
    if (url.hostname.replace(/^www\./i, '').toLowerCase() === 'youtu.be') {
      const normalized = new URL('https://www.youtube.com/watch');
      normalized.searchParams.set('v', url.pathname.replace(/^\//, ''));
      return normalized;
    }

    if (/\/shorts\/([a-z0-9_-]+)/i.test(url.pathname)) {
      const match = url.pathname.match(/\/shorts\/([a-z0-9_-]+)/i);
      const normalized = new URL('https://www.youtube.com/watch');
      normalized.searchParams.set('v', match?.[1] ?? '');
      return normalized;
    }
  }

  return url;
}

function parseUrl(rawUrl: string) {
  try {
    return new URL(rawUrl.trim());
  } catch {
    return null;
  }
}
