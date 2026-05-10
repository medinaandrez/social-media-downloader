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
- TikTok public-link extraction powered by `yt-dlp`

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
npm run api:dev
npm run web
npm run web:export
npm run typecheck
```

For local web development with the extractor, run the API and Expo in separate terminals:

```bash
npm run api:dev
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npm run web -- --port 8081
```

The `postinstall` script downloads the standalone `yt-dlp` binary into `.bin/yt-dlp`, which is intentionally gitignored. Re-run this manually with:

```bash
npm run server:install-ytdlp
```

For native builds later, install and configure EAS:

```bash
npx eas-cli init
npx eas-cli build --platform android
npx eas-cli build --platform ios
```
