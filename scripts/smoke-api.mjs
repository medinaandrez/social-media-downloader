const endpoint = `${(process.env.API_BASE_URL || 'https://socialm-downloader.vercel.app').replace(/\/$/, '')}/api/resolve`;

const tests = [
  {
    name: 'Twitter/X public video',
    platform: 'twitter',
    url: 'https://x.com/TwitterDev/status/1304102743196356610',
    expect: 'success',
  },
  {
    name: 'TikTok public video',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
    expect: 'success',
  },
  {
    name: 'Facebook public video',
    platform: 'facebook',
    url: 'https://www.facebook.com/facebook/videos/10153231379946729/',
    expect: 'success',
  },
  {
    name: 'Instagram anonymous access handling',
    platform: 'instagram',
    url: 'https://www.instagram.com/reel/CYWmuqyBK7q/',
    expect: 'success-or-access-error',
  },
  {
    name: 'YouTube public video best effort',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    expect: 'success-or-youtube-service-error',
  },
  {
    name: 'YouTube shorts URL normalization',
    platform: 'youtube',
    url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    expect: 'success',
  },
  {
    name: 'YouTube anti-bot handling',
    platform: 'youtube',
    url: 'https://youtu.be/PeLru2q5Z0E?si=n79aDFVGUVgZ-p8R',
    expect: 'success-or-youtube-bot-error',
  },
];

let failures = 0;

console.log(`Smoke testing ${endpoint}`);

for (const test of tests) {
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: test.url,
      platform: test.platform,
      language: 'es',
    }),
  });

  const payload = await readJson(response);
  const elapsed = `${Date.now() - started}ms`;
  const formats = payload.media?.formats ?? [];
  const downloadableCount = formats.filter((format) => Boolean(format.downloadUrl)).length;
  const isSuccess = response.ok && payload.ok === true && downloadableCount > 0;
  const isAccessError = response.status === 422
    && payload.ok === false
    && /sin sesion|sin iniciar sesion/i.test(payload.error ?? '');
  const isYouTubeBotError = response.status === 422
    && payload.ok === false
    && /anti-bot|bloqueo|blocked/i.test(payload.error ?? '');
  const isYouTubeServiceError = [503, 504].includes(response.status)
    && payload.ok === false
    && /youtube|function_invocation_timeout|tardo demasiado|took too long|deployment/i.test(payload.error ?? '');
  const passed = test.expect === 'success'
    ? isSuccess
    : test.expect === 'access-error'
      ? isAccessError
      : test.expect === 'success-or-youtube-bot-error'
        ? isSuccess || isYouTubeBotError
        : test.expect === 'success-or-youtube-service-error'
          ? isSuccess || isYouTubeServiceError
        : isSuccess || isAccessError;

  if (!passed) {
    failures += 1;
  }

  const status = passed ? 'PASS' : 'FAIL';
  const detail = payload.ok
    ? `${payload.media?.title ?? 'Untitled'} (${downloadableCount}/${formats.length} downloadable formats)`
    : payload.error;

  console.log(`${status} ${test.name} [${response.status}, ${elapsed}]`);
  console.log(`  ${detail}`);
}

if (failures > 0) {
  console.error(`Smoke test failed: ${failures} case(s) did not match expectations.`);
  process.exit(1);
}

console.log('Smoke test passed.');

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 240) };
  }
}
