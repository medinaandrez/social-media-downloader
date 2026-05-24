# Social Media Downloader Release Priorities

Current status: `beta funcional`

Recent evidence from web QA:

- Facebook web resolve and save flow works with a real public video.
- TikTok and Facebook resolve successfully at the deployed API level.
- Instagram anonymous-access failures are handled clearly.
- X / Twitter support is inconsistent by link and needs focused stabilization.

The app already works end-to-end on Android, but these are the best next steps before calling it broadly ready.

## Priority 1: QA On Real APK

Reason:
This app depends on real-world platform URLs, extractor behavior, file saving, and Android permissions. Those are the highest-risk areas.

Work:

- Run the checklist in [QA_CHECKLIST.md](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/QA_CHECKLIST.md)
- Record results in [QA_RESULTS_TEMPLATE.md](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/QA_RESULTS_TEMPLATE.md)
- Confirm at least one successful save per supported platform
- Record exact failures by source URL and platform

Definition of done:

- No crashes in normal flows
- Save and share both work on-device
- Known failure cases are documented

## Priority 2: UX Improvements With High Return

Reason:
The core flow works, but the app can feel incomplete if users do not know where files went or what failed.

Recommended improvements:

- Add an "Open file" or "Open gallery" action after successful save
- Improve post-download success copy to say where the file was saved
- Make extractor and timeout errors more specific
- Add a better empty or pending state when no downloadable format is available
- Reword X / Twitter pending states so users understand when the preview is real but the downloadable media is not available

Definition of done:

- User always knows what happened after save/share
- Common failures are understandable without guessing

## Priority 3: Backend Hardening

Reason:
Extractor-based apps usually fail at the edges first, not in the UI.

Recommended improvements:

- Improve logging around resolve failures and download failures
- Track timeout frequency
- Capture which supported platform links fail most often
- Review whether Twitter audio conversion limits need adjustment
- Compare successful vs non-successful X / Twitter payloads to identify why some status links return no downloadable URL

Definition of done:

- You can explain the top failure modes with real evidence
- Repeated failures are easier to debug

## Priority 4: Product Expansion

Reason:
Only add new platforms after the current four feel dependable.

Candidates after stabilization:

- YouTube Shorts or YouTube
- Better history actions like retry or reuse
- Saved downloads library inside the app

Definition of done:

- New platform work does not come before current-platform stability

## Recommendation

If the goal is:

- Personal use or small beta: the app is already usable
- Wider sharing: finish Priority 1 and at least part of Priority 2 first
