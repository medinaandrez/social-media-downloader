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
    pathPatterns: [/\/watch/i, /\/reel/i, /\/videos/i, /\/share\/v/i],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    hostPatterns: [/^tiktok\.com$/i, /^www\.tiktok\.com$/i, /^vm\.tiktok\.com$/i, /^vt\.tiktok\.com$/i],
    pathPatterns: [/\/video\//i, /^\/.+/i],
  },
];

export function detectPlatform(rawUrl: string): PlatformId | null {
  const parsed = parseUrl(rawUrl);
  if (!parsed) {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '');
  const pathname = parsed.pathname;

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
    normalizedUrl: parsed.toString(),
  };
}

function parseUrl(rawUrl: string) {
  try {
    return new URL(rawUrl.trim());
  } catch {
    return null;
  }
}
