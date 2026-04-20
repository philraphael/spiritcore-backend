# Stale Bundle And Legacy Path Purge Report

## Remaining legacy references found

- `server.mjs` still contains compatibility server routes for `/app/active-assets/*` and `/world-art/:filename`.
- No current frontend bundle entrypoints or live frontend request builders still reference `/world-art/*` or `/app/active-assets/*`.
- The stale `20260417033000` bundle stamp was still hardcoded in `spiritkins-app/index.html`, which allowed production browsers to keep requesting the older app bundle.

## Exact files changed

- `server.mjs`
- `spiritkins-app/index.html`
- `spiritkins-app/command-center.html`
- `spiritkins-app/app.js`
- `spiritkins-app/command-center.js`

## Cache-busting / versioning update

- Replaced hardcoded bundle query strings in the app and command-center HTML with a single server-injected `__SPIRITVERSE_APP_BUILD__` token.
- Added `injectSpiritverseBuild(...)` in `server.mjs` so `/app` and `/command-center` always render the current build marker into HTML at request time.
- Bumped `SPIRITVERSE_APP_BUILD` to `20260419223000`.
- The app entry now serves:
  - `/app/styles.css?t=20260419223000`
  - `/app/spiritverse-games.css?t=20260419223000`
  - `/app/spiritverse-games.js?t=20260419223000`
  - `/app/reveal-animation.js?t=20260419223000`
  - `/app/app.js?t=20260419223000`

## Legacy path purge

- Renamed the old `worldArtUrl(...)` helper in `spiritkins-app/app.js` to `canonicalWorldAssetUrl(...)`.
- Current world/concept/room asset calls now resolve only through `/app/assets/<category>/<filename>`.
- Updated the command-center asset placeholder text away from `/world-art/...` to `/app/assets/...`.

## Root cause of stale requests

- Production was still serving app HTML that explicitly pinned the frontend to `app.js?t=20260417033000`.
- That older bundle version still contained logic that could emit legacy requests, which is why newer visuals and older asset URL patterns were appearing together in live behavior.

## Canonical path system status

- Current live frontend entrypoints now use the canonical asset system only:
  - `/app/assets/concepts/...`
  - `/app/assets/rooms/...`
  - `/app/assets/boards/...`
  - `/app/assets/pieces/...`
  - `/app/assets/tokens/...`
  - `/app/assets/ui/...`
  - `/app/assets/fx/...`
- The remaining legacy paths in `server.mjs` are compatibility aliases only; they are no longer referenced by the current frontend runtime.

## Verification

- `node --check server.mjs`
- `node --check spiritkins-app/app.js`
- `node --check spiritkins-app/command-center.js`
- Repo search after patch shows no frontend-side `/world-art/*`, `/app/active-assets/*`, or `worldArtUrl(...)` references remaining.
