import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

type SupportedPlatform = 'youtube' | 'twitter' | 'instagram' | 'facebook' | 'tiktok';

export function hasOptionalYouTubeCookies() {
  return Boolean(readYouTubeCookiesFromEnv());
}

export async function withOptionalYouTubeCookies<T>(
  platform: SupportedPlatform,
  run: (cookiesPath?: string) => Promise<T>,
): Promise<T> {
  const cookiesContent = platform === 'youtube' ? readYouTubeCookiesFromEnv() : null;
  if (!cookiesContent) {
    return run();
  }

  const cookiesPath = join(tmpdir(), `smd-youtube-cookies-${randomUUID()}.txt`);
  await writeFile(cookiesPath, cookiesContent, 'utf8');

  try {
    return await run(cookiesPath);
  } finally {
    await rm(cookiesPath, { force: true });
  }
}

function readYouTubeCookiesFromEnv() {
  const base64Value = process.env.YTDLP_YOUTUBE_COOKIES_B64?.trim();
  if (base64Value) {
    return Buffer.from(base64Value, 'base64').toString('utf8');
  }

  const rawValue = process.env.YTDLP_YOUTUBE_COOKIES?.trim();
  if (rawValue) {
    return rawValue;
  }

  return null;
}
