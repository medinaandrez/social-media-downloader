import { createWriteStream, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { arch, platform } from 'node:os';
import { pipeline } from 'node:stream/promises';
import https from 'node:https';

const target = join(process.cwd(), '.bin', platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const force = process.argv.includes('--force') || process.env.YTDLP_FORCE_INSTALL === '1';

if (existsSync(target) && !force) {
  console.log(`yt-dlp already installed at ${target}`);
  process.exit(0);
}

const asset = assetForCurrentPlatform();
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;

mkdirSync(dirname(target), { recursive: true });
console.log(`Downloading ${asset} from yt-dlp latest release...`);

await download(url, target);

if (platform() !== 'win32') {
  chmodSync(target, 0o755);
}

console.log(`Installed yt-dlp at ${target}`);

function assetForCurrentPlatform() {
  const currentPlatform = platform();
  const currentArch = arch();

  if (currentPlatform === 'darwin') {
    return 'yt-dlp_macos';
  }

  if (currentPlatform === 'linux' && currentArch === 'x64') {
    return 'yt-dlp_linux';
  }

  if (currentPlatform === 'linux' && currentArch === 'arm64') {
    return 'yt-dlp_linux_aarch64';
  }

  if (currentPlatform === 'win32') {
    return 'yt-dlp.exe';
  }

  throw new Error(`Unsupported platform for standalone yt-dlp: ${currentPlatform}/${currentArch}`);
}

function download(url, outputPath, redirects = 0) {
  if (redirects > 5) {
    throw new Error('Too many redirects while downloading yt-dlp.');
  }

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const location = response.headers.location;

      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
        response.resume();
        resolve(download(location, outputPath, redirects + 1));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to download yt-dlp: HTTP ${response.statusCode}`));
        return;
      }

      pipeline(response, createWriteStream(outputPath)).then(resolve).catch(reject);
    }).on('error', reject);
  });
}
