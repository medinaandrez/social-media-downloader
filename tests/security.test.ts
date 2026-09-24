import assert from 'node:assert/strict';
import test from 'node:test';

import { safeTokenEquals } from '../api/security';
import { readDedicatedYouTubeServiceConfig } from '../api/youtube-service';
import { detectPlatform, isSupportedPublicUrl } from '../src/shared/platforms';

test('rejects local and cloud metadata URLs even when a platform is selected', () => {
  const local = isSupportedPublicUrl('http://127.0.0.1:3000/private', 'youtube');
  const metadata = isSupportedPublicUrl('http://169.254.169.254/latest/meta-data', 'instagram');
  const external = isSupportedPublicUrl('https://example.com/video', 'tiktok');

  assert.equal(local.ok, false);
  assert.equal(metadata.ok, false);
  assert.equal(external.ok, false);
});

test('requires HTTPS for supported platforms', () => {
  assert.equal(isSupportedPublicUrl('http://www.youtube.com/watch?v=PeLru2q5Z0E', 'youtube').ok, false);
  assert.equal(isSupportedPublicUrl('https://www.youtube.com/watch?v=PeLru2q5Z0E', 'youtube').ok, true);
});

test('rejects a platform that does not match the URL', () => {
  const result = isSupportedPublicUrl('https://www.instagram.com/reel/example/', 'youtube');
  assert.deepEqual(result, { ok: false, error: 'Selected platform does not match the link' });
});

test('keeps supported platform detection working', () => {
  assert.equal(detectPlatform('https://youtu.be/PeLru2q5Z0E'), 'youtube');
  assert.equal(detectPlatform('https://www.instagram.com/reel/example/'), 'instagram');
  assert.equal(detectPlatform('https://x.com/user/status/123456789'), 'twitter');
});

test('compares administrative tokens without accepting partial values', () => {
  assert.equal(safeTokenEquals('correct-token', 'correct-token'), true);
  assert.equal(safeTokenEquals('correct', 'correct-token'), false);
  assert.equal(safeTokenEquals('incorrect-token', 'correct-token'), false);
});

test('reserves time for the YouTube fallback when the dedicated service stalls', () => {
  const previousUrl = process.env.YOUTUBE_RESOLVE_SERVICE_URL;
  const previousTimeout = process.env.YOUTUBE_RESOLVE_SERVICE_TIMEOUT_MS;
  process.env.YOUTUBE_RESOLVE_SERVICE_URL = 'https://youtube-service.example.com';
  process.env.YOUTUBE_RESOLVE_SERVICE_TIMEOUT_MS = '60000';

  try {
    assert.equal(readDedicatedYouTubeServiceConfig()?.timeoutMs, 12000);
  } finally {
    if (previousUrl === undefined) delete process.env.YOUTUBE_RESOLVE_SERVICE_URL;
    else process.env.YOUTUBE_RESOLVE_SERVICE_URL = previousUrl;
    if (previousTimeout === undefined) delete process.env.YOUTUBE_RESOLVE_SERVICE_TIMEOUT_MS;
    else process.env.YOUTUBE_RESOLVE_SERVICE_TIMEOUT_MS = previousTimeout;
  }
});
