#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const defaultUrl = 'https://youtu.be/PeLru2q5Z0E?si=n79aDFVGUVgZ-p8R';
const url = process.env.YOUTUBE_TEST_URL || process.argv[2] || defaultUrl;
const proxy = process.env.YTDLP_YOUTUBE_PROXY || process.env.YTDLP_PROXY || process.argv[3] || '';
const ytDlpPath = process.env.YTDLP_PATH
  || join(process.cwd(), '.bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

const strategies = [
  process.env.YTDLP_EXTRACTOR_ARGS,
  'youtube:player_client=mweb,default',
  'youtube:player_client=mweb,default;player_skip=webpage',
  'youtube:player_client=android,ios,mweb,web,default;player_skip=webpage',
  'youtube:player_client=android,ios',
  'youtube:player_client=tv,web_embedded,ios,android,mweb,default;player_skip=webpage',
].filter(Boolean);

if (!existsSync(ytDlpPath)) {
  console.error(`yt-dlp binary not found at ${ytDlpPath}. Run npm install first.`);
  process.exit(1);
}

console.log(`Testing YouTube extraction for: ${url}`);
console.log(proxy ? 'Proxy: configured' : 'Proxy: not configured');

let lastError = '';

for (const extractorArgs of [...new Set(strategies)]) {
  const args = [
    '--dump-single-json',
    '--skip-download',
    '--no-playlist',
    '--force-ipv4',
    '--socket-timeout',
    '20',
    '--retries',
    '1',
    '--extractor-args',
    extractorArgs,
    '--js-runtimes',
    process.env.YTDLP_JS_RUNTIMES || 'node',
  ];

  if (proxy) {
    args.push('--proxy', proxy);
  }

  args.push(url);

  try {
    const { stdout } = await execFileAsync(ytDlpPath, args, {
      timeout: Number(process.env.YOUTUBE_PROXY_TEST_TIMEOUT_MS || 120000),
      maxBuffer: 1024 * 1024 * 8,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || join(process.cwd(), '.render', 'config'),
      },
    });
    const payload = JSON.parse(stdout);
    const formats = (payload.formats || []).filter((format) => {
      return format.url && !format.has_drm && ['http', 'https'].includes(String(format.protocol));
    });

    if (formats.length > 0) {
      console.log(`OK: ${payload.title || payload.id}`);
      console.log(`Strategy: ${extractorArgs}`);
      console.log(`Downloadable formats: ${formats.length}`);
      process.exit(0);
    }

    lastError = `No downloadable formats with strategy: ${extractorArgs}`;
    console.warn(lastError);
  } catch (error) {
    lastError = sanitizeError(error);
    console.warn(`Failed strategy: ${extractorArgs}`);
    console.warn(lastError);
  }
}

console.error('YouTube extraction still failed.');
console.error(lastError);
process.exit(1);

function sanitizeError(error) {
  const raw = `${error?.message || ''}\n${error?.stderr || ''}`.trim();
  return proxy ? raw.replaceAll(proxy, '[proxy-redacted]') : raw;
}
