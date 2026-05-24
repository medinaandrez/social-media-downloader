# Social Media Downloader Web QA Results

Date: `2026-05-17`
Target: `https://socialm-downloader.vercel.app`
Browser: `Safari on macOS`

## Web Matrix

| Platform | Link | Method | Result | Notes |
| --- | --- | --- | --- | --- |
| Facebook | `https://www.facebook.com/NASA/videos/nasa-2025-to-the-moon-mars-and-beyond/587352057218646/` | Manual UI | Pass | Preview resolved and Safari saved `nasa-2025-to-the-moon-mars-and-beyond-high.mp4`. |
| X / Twitter | `https://x.com/NASA/status/1951245359604203914` | Manual UI | Partial | Preview resolved, but UI showed `No se encontro una URL descargable...` and left `Extractor pendiente`. |
| X / Twitter | `https://x.com/NASA/status/1951245359604203914` | Production re-test after fix | Partial | Resolver now returns ready formats through `/api/video`, but low-quality replay preparation timed out with `504` and a clear timeout message. |
| X / Twitter | `https://x.com/TwitterDev/status/1304102743196356610` | API smoke | Pass | `/api/resolve` returned `3/3` downloadable formats. |
| TikTok | `https://www.tiktok.com/@scout2015/video/6718335390845095173` | API smoke | Pass | `/api/resolve` returned `2/3` downloadable formats. |
| Facebook | `https://www.facebook.com/facebook/videos/10153231379946729/` | API smoke | Pass | `/api/resolve` returned `2/3` downloadable formats. |
| Instagram | `https://www.instagram.com/reel/CYWmuqyBK7q/` | API smoke | Pass | Expected access restriction handled cleanly with `422` and a clear anonymous-access message. |

## Summary

- Total cases run: `7`
- Passed: `5`
- Partial: `2`
- Failed: `0`

## Main Findings

- Facebook web flow is currently the strongest validated case because it resolved and downloaded through the real browser UI.
- X / Twitter support is inconsistent by source URL. Some links return direct downloadable formats, while replay-style links now fall back to preparation but may still hit a timeout.
- Instagram anonymous-access handling is product-friendly: it fails clearly instead of silently.
- TikTok looks healthy at the resolver/API layer, but this pass did not include a full browser save flow for TikTok yet.

## Recommended Follow-Up

1. Add one manual browser save test for TikTok.
2. Add one manual browser save test for an X / Twitter URL that is already known to return downloadable formats.
3. Treat inconsistent X / Twitter extraction and replay timeout handling as the highest-priority supported-platform issue on web.
