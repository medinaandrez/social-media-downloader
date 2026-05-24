# Social Media Downloader

Expo app for Android, iOS, and mobile web. It lets a user paste a public social media link, detect or select the platform, preview the item, choose video/audio quality, and then save or share the file.

## Stack

- Expo + React Native + TypeScript
- Expo Router
- Local history with AsyncStorage
- Web export ready for Vercel
- Vercel API route at `api/resolve.ts`
- EAS build profiles in `eas.json`
- Local API server for development with `npm run api:dev`
- Public-link extraction powered by `yt-dlp`

## Current Backend Contract

`POST /api/resolve`

```json
{
  "url": "https://twitter.com/user/status/123",
  "platform": "twitter",
  "language": "es"
}
```

The endpoint validates supported public links and returns the shape the app needs. The extraction layer is intentionally isolated so public-content extractors can be connected per platform without changing the UI.

## Commands

```bash
npm run start
npm run android:doctor
npm run android:devices
npm run android:sdk
npm run api:dev
npm run web
npm run web:export
npm run typecheck
npm run smoke:api
npm run assets:brand
```

For local web development with the extractor, run the API and Expo in separate terminals:

```bash
npm run api:dev
npm run youtube:service
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npm run web -- --port 8081
```

The `postinstall` script downloads the standalone `yt-dlp` binary into `.bin/yt-dlp`, which is intentionally gitignored. Re-run this manually with:

```bash
npm run server:install-ytdlp
```

### Optional YouTube cookies

YouTube may occasionally require anti-bot verification for some public videos when `yt-dlp` runs from a server environment. This project supports optional YouTube cookies through environment variables:

```bash
YTDLP_YOUTUBE_COOKIES_B64=...
```

Recommended setup:

1. Export a valid `youtube.com` cookies file in Netscape format.
2. Base64-encode the file contents.
3. Store the encoded value in `YTDLP_YOUTUBE_COOKIES_B64` locally or in Vercel project environment variables.

The backend will write the cookies to a temporary file only for YouTube requests and delete it after the extraction finishes.

Helper script:

```bash
scripts/vercel-set-youtube-cookies.sh /absolute/path/to/youtube-cookies.txt
```

Current recommendation:

- Treat YouTube support as `best effort`.
- Some public videos resolve normally.
- Some public videos may still fail temporarily because YouTube blocks server-side extraction with anti-bot checks.
- The app now surfaces that case with a specific error instead of a generic extraction failure.

### Dedicated YouTube resolve service

This repo can now route only YouTube requests to a standalone extraction service outside Vercel while keeping the same `/api/resolve` contract for the app.

Main app environment:

```bash
YOUTUBE_RESOLVE_SERVICE_URL=https://your-youtube-service.example.com
YOUTUBE_RESOLVE_SERVICE_TOKEN=change-me
YOUTUBE_RESOLVE_SERVICE_TIMEOUT_MS=30000
```

Standalone service:

```bash
PORT=3200
YOUTUBE_RESOLVE_SERVICE_TOKEN=change-me
YTDLP_YOUTUBE_COOKIES_B64=...
YTDLP_YOUTUBE_TIMEOUT_MS=45000
npm run youtube:service
```

The main Vercel backend will:

- keep handling Twitter, Instagram, Facebook, and TikTok locally
- forward only YouTube requests to `YOUTUBE_RESOLVE_SERVICE_URL` when configured
- fall back to the local extractor if that dedicated service is unavailable

Docker deploy option:

```bash
docker build -f Dockerfile.youtube -t smd-youtube-service .
docker run --rm -p 3200:3200 \
  -e YOUTUBE_RESOLVE_SERVICE_TOKEN=change-me \
  -e YTDLP_YOUTUBE_COOKIES_B64=... \
  smd-youtube-service
```

Render blueprint option:

```bash
render.yaml
```

Use the included `render.yaml` to create a Docker web service named `social-media-downloader-youtube`, then set:

- `YOUTUBE_RESOLVE_SERVICE_TOKEN`
- `YTDLP_YOUTUBE_COOKIES_B64`
- `YTDLP_YOUTUBE_TIMEOUT_MS=45000`

The app points native builds to the production API by default:

```bash
EXPO_PUBLIC_API_BASE_URL=https://socialm-downloader.vercel.app
```

For development builds with full native permissions, install and configure EAS:

```bash
npx eas-cli init
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

## Android Local Tooling

This repo now includes helper scripts for the Android host setup used by Expo development builds on macOS/Homebrew.

Expected local paths:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
```

Useful commands:

```bash
npm run android:doctor
npm run android:sdk
npm run android:devices
```

To make the environment permanent in `zsh`, add:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH="/opt/homebrew/opt/openjdk@17/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"
```

Current local SDK packages expected by the project:

```bash
platform-tools
platforms;android-35
build-tools;35.0.0
```

Once the device is visible in `npm run android:devices`, the usual flow is:

```bash
npx eas-cli build --profile development --platform android
npx expo start --dev-client
```

For production builds:

```bash
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
```

## Release Workflow

- Manual Android QA checklist: [QA_CHECKLIST.md](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/QA_CHECKLIST.md)
- QA results capture template: [QA_RESULTS_TEMPLATE.md](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/QA_RESULTS_TEMPLATE.md)
- Release priorities and next steps: [RELEASE_PRIORITIES.md](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/RELEASE_PRIORITIES.md)
- Optimization roadmap: [OPTIMIZATION_ROADMAP.md](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/OPTIMIZATION_ROADMAP.md)
