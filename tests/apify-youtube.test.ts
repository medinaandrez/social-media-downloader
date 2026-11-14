import assert from 'node:assert/strict';
import test from 'node:test';

import { readApifyYouTubeJob, startApifyYouTube } from '../src/server/apify-youtube';

test('starts the Actor asynchronously with residential fallback disabled and a per-run cost cap', async () => {
  const previousToken = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = 'test-token';
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.includes('/runs?')) {
      return Response.json({ data: { id: 'run-id-12345678', status: 'SUCCEEDED', defaultDatasetId: 'dataset-1' } });
    }
    return Response.json([{
      status: 'success',
      videoId: 'video-1',
      title: 'Test video',
      uploader: 'Test channel',
      duration: '0:15',
      deliveredQuality: '720p',
      originalUrl: 'https://www.youtube.com/watch?v=video-1',
      downloadUrl: 'https://api.apify.com/v2/key-value-stores/store/records/video-1.mp4?signature=test',
    }]);
  };

  try {
    const result = await startApifyYouTube('https://www.youtube.com/watch?v=video-1', 'es');

    assert.equal(requests.length, 2);
    const runUrl = new URL(requests[0].url);
    assert.equal(runUrl.searchParams.has('waitForFinish'), false);
    assert.equal(runUrl.searchParams.get('maxTotalChargeUsd'), '0.5');
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      urls: [{ url: 'https://www.youtube.com/watch?v=video-1' }],
      quality: '720',
      format: 'default',
      residentialProxyMode: 'disabled',
    });
    assert.equal(result.status, 'succeeded');
    if (result.status !== 'succeeded') return;
    const media = result.media;
    assert.equal(media.title, 'Test video');
    assert.equal(media.durationLabel, '0:15');
    assert.equal(media.formats[0]?.downloadUrl?.startsWith('https://api.apify.com/'), true);
    assert.equal(media.formats[0]?.status, 'ready');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = previousToken;
  }
});

test('rejects a dataset download URL outside Apify', async () => {
  const previousToken = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = 'test-token';
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return requestCount === 1
      ? Response.json({ data: { id: 'run-id-12345678', status: 'SUCCEEDED', defaultDatasetId: 'dataset-1' } })
      : Response.json([{
        status: 'success',
        downloadUrl: 'https://attacker.example/video.mp4',
      }]);
  };

  try {
    await assert.rejects(
      startApifyYouTube('https://www.youtube.com/watch?v=video-1', 'en'),
      /Could not prepare this YouTube video/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = previousToken;
  }
});

test('checks an Apify run without waiting for it and verifies its Actor ownership', async () => {
  const previousToken = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = 'test-token';
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({ data: { actId: 'marielise.dev~youtube-video-downloader', status: 'RUNNING' } });
  };

  try {
    const result = await readApifyYouTubeJob('run-id-12345678', 'https://youtu.be/video-1', 'es');
    assert.deepEqual(result, { status: 'pending' });
    assert.match(requestedUrl, /\/v2\/actor-runs\/run-id-12345678$/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = previousToken;
  }
});

test('returns a run identifier immediately when the Actor is still processing', async () => {
  const previousToken = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = 'test-token';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: { id: 'run-id-12345678', status: 'RUNNING' } });

  try {
    const result = await startApifyYouTube('https://www.youtube.com/watch?v=video-1', 'es');
    assert.deepEqual(result, { status: 'pending', runId: 'run-id-12345678' });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = previousToken;
  }
});

test('reports when Apify ends a run at the configured charge ceiling', async () => {
  const previousToken = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = 'test-token';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    data: {
      id: 'run-id-12345678',
      status: 'ABORTED',
      statusMessage: 'Run stopped after reaching max total charge limit',
    },
  });

  try {
    const result = await startApifyYouTube('https://www.youtube.com/watch?v=video-1', 'es');
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') return;
    assert.match(result.error, /US\$0\.50/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = previousToken;
  }
});
