# Social Media Downloader Optimization Roadmap

Current status: `functional beta with growing technical debt`

This document turns the latest code review into an execution plan.

## Execution Snapshot

Completed in the first optimization pass:

- Removed the legacy Expo bootstrap files and kept `expo-router/entry` as the only app entrypoint.
- Centralized shared app constants in `src/config/appConfig.ts`.
- Reused a shared extractor-required format preset from both frontend and backend.
- Hardened `api/download.ts` with a hostname allowlist instead of accepting arbitrary remote HTTPS URLs.
- Simplified `api/resolve-core.ts` by removing the dead fallback path for unsupported extractor branches.

Still pending from the roadmap:

- Split the large screens into hooks and presentational components.
- Refine permission/download flow ordering.
- Add automated tests and CI checks.

## Goals

- Reduce regression risk when adding new features
- Improve runtime stability on Android, iPhone, and web
- Remove dead or duplicated code paths
- Make the codebase easier to reason about and maintain
- Prepare the app for broader QA and future expansion

## Review Summary

Main themes found in the review:

- The app works, but key files are too large and mix UI, state, and business logic.
- There is duplicated contract logic between frontend and backend.
- There are dead or misleading code paths that should be removed.
- Web download and replay preparation have real infrastructure constraints.
- Some API surfaces are too permissive and should be hardened.
- The project lacks automated tests for critical parsing and resolver logic.

## Optimization Principles

When implementing this roadmap, prefer these rules:

- Keep one source of truth for each constant, contract shape, and fallback policy.
- Separate UI rendering from state orchestration and platform-specific side effects.
- Prefer explicit platform capability handling over hidden fallback behavior.
- Optimize for simpler code paths before micro-optimizing performance.
- Improve observability before adding more extraction complexity.

## Priority Matrix

| Priority | Theme | Why it matters |
| --- | --- | --- |
| P1 | Entry points and backend hardening | Prevent confusion, misuse, and infra-aligned failures |
| P2 | Screen decomposition and shared contract cleanup | Biggest payoff for maintainability and stability |
| P3 | Download flow and UX error quality | Improves product feel and reduces wasted work |
| P4 | Tests and tooling | Protects future changes |

## Phase 1: Critical Hygiene

Target outcome:
- Remove misleading bootstrap files
- Reduce backend risk
- Align code behavior with deployment limits

### 1. Remove dead entrypoints

Files:
- [App.tsx](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/App.tsx)
- [index.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/index.ts)
- [package.json](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/package.json)

Tasks:
- Confirm Expo Router is the only supported entry path.
- Delete the placeholder app bootstrap files, or replace them with a fail-fast comment-only shim if needed for tooling compatibility.
- Verify no build script or native config still references the old bootstrap path.

Impact:
- High

Effort:
- Low

### 2. Harden the download proxy

Files:
- [api/download.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/download.ts)
- [src/services/downloads.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/downloads.ts)

Tasks:
- Replace the current “any remote https URL” acceptance with:
  - a hostname allowlist, or
  - signed download tokens emitted by `/api/resolve`
- Reject URLs for unknown hosts early.
- Add clear logging for blocked proxy attempts.

Impact:
- Very high

Effort:
- Medium

### 3. Align replay extraction with infrastructure reality

Files:
- [api/video.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/video.ts)
- [vercel.json](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/vercel.json)
- [src/services/downloads.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/downloads.ts)

Tasks:
- Stop pretending long replay processing fits cleanly into the current Vercel function model.
- Decide one of these directions:
  - keep current infra and explicitly classify long X replays as unsupported on web, or
  - move replay processing to a more suitable backend job/execution model
- Keep the clear user-facing replay timeout message either way.

Impact:
- High

Effort:
- Medium to high

## Phase 2: Decompose Oversized Screens

Target outcome:
- Smaller components
- Lower cognitive load
- Less coupling between UI and async logic

### 1. Break up the home screen

Primary file:
- [app/index.tsx](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/app/index.tsx)

Suggested extraction plan:
- `src/features/downloader/useDownloaderScreenState.ts`
- `src/features/downloader/LinkInputPanel.tsx`
- `src/features/downloader/PlatformSelector.tsx`
- `src/features/downloader/PreviewCard.tsx`
- `src/features/downloader/FormatSelector.tsx`
- `src/features/downloader/DownloadActionSheet.tsx`
- `src/features/downloader/HistoryList.tsx`
- `src/features/downloader/downloaderStyles.ts`

Tasks:
- Move all non-render helper functions out of the screen file.
- Extract async flows (`resolve`, `copy from clipboard`, `save/share`) into a dedicated hook.
- Extract style creation into a feature-level style module.
- Keep the route file mostly as assembly and prop wiring.

Impact:
- Very high

Effort:
- High

### 2. Break up settings

Primary file:
- [app/settings.tsx](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/app/settings.tsx)

Suggested extraction plan:
- `src/features/settings/LanguageSection.tsx`
- `src/features/settings/ThemeSection.tsx`
- `src/features/settings/HistorySection.tsx`
- `src/features/settings/AuthorSection.tsx`

Tasks:
- Extract reusable button primitives for settings rows/options.
- Move external link helpers and static project metadata into a small constants file.

Impact:
- Medium

Effort:
- Medium

## Phase 3: Consolidate Shared Contract Logic

Target outcome:
- Fewer duplicated fallbacks
- Easier feature changes
- Reduced inconsistency risk

### 1. Create shared app config

Files to simplify:
- [src/services/resolver.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/resolver.ts)
- [src/services/downloads.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/downloads.ts)
- [app.json](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/app.json)

Tasks:
- Create a shared config helper for:
  - production API base URL
  - environment fallbacks
  - feature flags if needed later

Impact:
- Medium

Effort:
- Low

### 2. Create shared “pending formats” builder

Duplicated logic exists in:
- [src/services/resolver.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/resolver.ts)
- [api/resolve-core.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/resolve-core.ts)

Tasks:
- Move pending format creation into a shared helper module.
- Use a single data definition for default quality labels and mime types.

Impact:
- Medium

Effort:
- Low

### 3. Remove dead fallback branch in resolve-core

File:
- [api/resolve-core.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/resolve-core.ts)

Tasks:
- Remove the unreachable generic fallback branch for unsupported extractor platforms.
- Keep only the currently supported platform flow.

Impact:
- Medium

Effort:
- Low

### 4. Centralize platform matching metadata

Files:
- [src/shared/platforms.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/shared/platforms.ts)
- [api/audio.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/audio.ts)
- [api/video.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/video.ts)

Tasks:
- Move hostname/path rules into a single reusable representation.
- Reuse it in both validation and backend allowlists where possible.
- Avoid scattering “what counts as a valid platform URL” across the repo.

Impact:
- Medium

Effort:
- Medium

## Phase 4: Improve Download Flow and Runtime Behavior

Target outcome:
- Less wasted work
- Better error clarity
- More predictable user experience

### 1. Reorder mobile save flow

File:
- [src/services/downloads.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/downloads.ts)

Tasks:
- For `save`, request permission before starting the download when possible.
- If permission is denied, fail fast with a specific error.
- Keep `share` separate so it does not request media library access unnecessarily.

Impact:
- High

Effort:
- Medium

### 2. Improve error taxonomy

Files:
- [src/services/downloads.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/downloads.ts)
- [src/i18n/translations.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/i18n/translations.ts)
- [api/audio.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/audio.ts)
- [api/video.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/video.ts)
- [api/resolve-core.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/resolve-core.ts)

Tasks:
- Separate:
  - permission denied
  - size too large
  - upstream unavailable
  - timeout
  - unsupported replay
  - generic failure
- Avoid overusing `genericError`.

Impact:
- High

Effort:
- Medium

### 3. Improve history persistence rules

Files:
- [src/context/AppState.tsx](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/context/AppState.tsx)
- [src/services/storage.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/storage.ts)

Tasks:
- Replace the duplicated hardcoded `25` limit with a shared constant.
- Decide whether deduplication by `sourceUrl` is still the correct behavior for repeated downloads with different formats.

Impact:
- Medium

Effort:
- Low

## Phase 5: Testing and Tooling

Target outcome:
- Safer refactors
- Better regression coverage
- Faster confidence during release work

### 1. Add unit tests for platform parsing

Targets:
- [src/shared/platforms.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/shared/platforms.ts)

Recommended cases:
- valid URLs for each supported platform
- malformed URLs
- platform mismatch cases
- normalized Facebook watch URLs

Impact:
- High

Effort:
- Medium

### 2. Add tests for resolver behavior

Targets:
- [src/services/resolver.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/src/services/resolver.ts)
- [api/resolve-core.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/resolve-core.ts)

Recommended cases:
- successful payload handling
- API error mapping
- local preview fallback on web localhost
- platform-specific extraction message mapping

Impact:
- High

Effort:
- Medium

### 3. Add baseline repo tooling

Files:
- [package.json](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/package.json)

Tasks:
- Add linting
- Add test script
- Add CI command that at least runs:
  - typecheck
  - lint
  - unit tests

Impact:
- High

Effort:
- Medium

## Suggested Execution Order

### Sprint 1

- Remove dead entrypoints
- Harden `api/download`
- Add shared constants for API base URL and history limit
- Remove dead fallback logic in `resolve-core`

### Sprint 2

- Refactor `app/index.tsx` into feature components and a screen hook
- Refactor `app/settings.tsx` into sections
- Consolidate pending format builders

### Sprint 3

- Improve mobile permission-first save flow
- Improve error taxonomy and user messages
- Add tests for `platforms.ts` and `resolve-core.ts`

### Sprint 4

- Reassess long replay handling strategy on web
- Decide whether current Vercel model is enough or if media preparation needs another backend

## Estimated Effort

| Workstream | Effort | Risk |
| --- | --- | --- |
| Entry point cleanup | Low | Low |
| Download proxy hardening | Medium | Medium |
| Home screen decomposition | High | Medium |
| Settings decomposition | Medium | Low |
| Shared contract cleanup | Medium | Low |
| Download flow reorder | Medium | Medium |
| Testing baseline | Medium | Low |
| Replay infra strategy | High | High |

## Definition of Done For Optimization

The optimization pass should be considered complete when:

- There is only one supported app bootstrap path.
- The download proxy is restricted to known-safe usage.
- The home screen is split into smaller units with clear responsibilities.
- The settings screen is modular.
- Shared defaults and pending-format logic are centralized.
- Permission and download flows are more efficient and more specific in failure modes.
- Basic automated tests protect parsing and resolver behavior.
- Known replay limitations are either explicitly unsupported or backed by suitable infrastructure.

## Recommended Immediate Next Step

If starting implementation now, begin with:

1. Delete or neutralize [App.tsx](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/App.tsx) and [index.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/index.ts)
2. Harden [api/download.ts](/Volumes/Data/Users/andres/Documents/Codex/2026-05-10/social-media-downloader/api/download.ts)
3. Extract a shared `src/config/appConfig.ts`

That gives the best stability-to-effort ratio before larger refactors.
