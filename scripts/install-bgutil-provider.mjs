import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const renderDir = process.env.BGUTIL_INSTALL_DIR || join(repoRoot, '.render');
const configDir = process.env.XDG_CONFIG_HOME || join(renderDir, 'config');
const pluginPath = join(configDir, 'yt-dlp', 'plugins', 'bgutil-ytdlp-pot-provider.zip');
const providerDir = join(renderDir, 'bgutil-ytdlp-pot-provider');
const providerServerDir = join(providerDir, 'server');
const providerRepoUrl = 'https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git';
const providerVersion = '2.0.1';
const providerZipUrl = `https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${providerVersion}/bgutil-ytdlp-pot-provider.zip`;

if (Number(process.versions.node.split('.')[0]) < 22) {
  throw new Error('The YouTube token provider requires Node.js 22 or later.');
}

await mkdir(dirname(pluginPath), { recursive: true });
await download(providerZipUrl, pluginPath);

await rm(providerDir, { recursive: true, force: true });
await run('git', [
  'clone',
  '--single-branch',
  '--branch',
  providerVersion,
  '--depth',
  '1',
  providerRepoUrl,
  providerDir,
]);
await run('npm', ['ci'], { cwd: providerServerDir });
// Patch known transitive advisories in the upstream 2.0.1 lockfile.
await run('npm', ['install', '--no-save', '--ignore-scripts', 'proxy-addr@2.0.8', 'source-map-js@1.2.2'], { cwd: providerServerDir });
await run('npx', ['tsc'], { cwd: providerServerDir });

console.log('bgutil YouTube PO token provider installed.');

async function download(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  await pipeline(response.body, createWriteStream(targetPath));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}
