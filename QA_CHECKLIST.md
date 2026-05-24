# Social Media Downloader QA Checklist

Use this checklist on real mobile devices before calling the app release-ready.

## Scope

- Builds under test:
  - Android `preview` standalone APK
  - iPhone local signed build
- Current supported platforms: TikTok, Instagram, Facebook, X/Twitter
- Out of scope for this checklist: YouTube, iOS native, Play Store submission

## Test Setup

- Install the latest Android standalone APK on a real Android device.
- Install the latest signed iPhone build on a real iPhone.
- Confirm the API is reachable from both devices.
- Prepare at least 2 public links for each supported platform.
- Include a mix of short and long videos when possible.

## Smoke Test

- App opens without Metro or local network dependency.
- Home screen renders without blank sections or crashes.
- Settings screen opens and returns correctly.
- Language switch works for Spanish and English.
- Theme preference changes apply without layout glitches.
- App name and icon look acceptable on Android and iPhone home screens.

## Input And Resolve

- Paste a valid TikTok URL from clipboard and confirm platform auto-detect.
- Paste a valid Instagram reel URL and confirm preview resolves.
- Paste a valid Facebook watch or reel URL and confirm preview resolves.
- Paste a valid X/Twitter status URL and confirm preview resolves.
- Enter a malformed URL and confirm a clear validation error appears.
- Enter a supported domain with unsupported content and confirm a clear extractor error appears.
- Change the selected platform manually to the wrong one and confirm the mismatch error is understandable.

## Preview And Format Selection

- Thumbnail, title, author, and duration render when available.
- Available video formats are selectable without broken states.
- Audio option behaves correctly for each platform.
- Unsupported or pending formats do not appear as ready-to-download options.
- Switching between video and audio updates the selected format correctly.

## Download Save Flow

- Download a TikTok video and confirm success message appears.
- Download an Instagram video and confirm success message appears.
- Download a Facebook video and confirm success message appears.
- Download a Twitter/X video and confirm success message appears.
- Confirm the saved file appears in Gallery/Photos or Files where the user expects it.
- Deny storage/media permission and confirm the app fails gracefully.
- Re-enable permission and confirm download works without reinstalling the app.

## iPhone Save Flow

- Confirm iPhone asks for Photos permission only when needed.
- Confirm a saved file appears in Photos or Files as expected.
- Deny Photos access and confirm the error is understandable.
- Re-enable Photos access from iPhone Settings and confirm save works again.

## Share Flow

- Share a resolved file using Android share sheet.
- Share a resolved file using iPhone share sheet.
- Confirm the share sheet opens without freezing the app.
- Confirm canceling the share sheet does not crash the app.

## Error Handling

- Test a private or deleted post and confirm the user sees a meaningful error.
- Test a slow or flaky network and confirm timeout behavior is understandable.
- Test a very large audio conversion case and confirm the app surfaces the size limitation clearly.
- Test API unavailability and confirm the user does not get a silent failure.
- Confirm iPhone and Android show equally understandable errors for the same failing link.

## History

- A successful download creates a history entry.
- Repeated download of the same source updates or deduplicates history as expected.
- History remains after closing and reopening the app.
- Clear history removes only local history and does not affect files already saved on the device.
- Confirm history behavior is consistent between Android and iPhone.

## Release Gate

Consider the mobile app ready for broader distribution only if:

- All four supported platforms complete at least one successful download.
- Save and share flows both work on Android and iPhone.
- Permission-denied behavior is understandable.
- No crashes occur during normal use.
- Known failures are documented and acceptable.

## Suggested Test Matrix

- TikTok: 2 public links
- Instagram: 2 reels or posts with video
- Facebook: 2 public videos
- X/Twitter: 2 status links, including one with audio fallback behavior

## Notes To Capture During QA

- Source URL used
- Platform
- Device model and Android version
- Device platform and OS version
- Result: success, partial success, fail
- Exact error shown to user
- Whether file actually appeared in Gallery or Files

## Recommended QA Pass Order

1. Android smoke test
2. Android save/share test
3. iPhone smoke test
4. iPhone save/share test
5. Cross-platform error handling comparison
6. Final history and settings regression pass
