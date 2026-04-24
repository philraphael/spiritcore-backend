# Frontend Stability Render Loop And Games Fix Report

## Root Cause

- Wake/listening startup was being triggered from multiple frontend paths without a shared dedupe guard:
  - render-time wake resume
  - focus/return wake resume
  - wake resume after recognition end
  - auto-turn mic reopen for game flow
- Because those paths all funneled into `startListening()` without a cooldown, the app could repeatedly restart recognition and drive repeated render churn.
- Missing Spiritkin idle/speaking video files could fail repeatedly because the runtime remembered the failed URL but did not promote the Spiritkin into a stable still-image-only mode after essential video failure.
- The Games room shell had no explicit authority class for the active games surface, so the sticky secondary chat rail could continue competing with the primary games panel through overlapping late CSS rules.

## Files Changed

- `spiritkins-app/app.js`
- `spiritkins-app/styles.css`

## Fix Implemented

### Wake / Render Loop Stabilization

- Removed render-time wake auto-resume startup.
- Added a shared auto-start cooldown in `startListening()` for:
  - `auto-turn`
  - `voice-mode-enable`
  - `wake-mode-enable`
  - `unmute`
  - `wake-mode-unmute`
  - `wake-mode-*`
- Added explicit suppression logs:
  - `[Voice] start-suppressed-already-listening`
  - `[Voice] start-suppressed-cooldown`
- Preserved manual voice flow by limiting suppression to already-listening cases and auto-start cooldown cases.

### Missing Video Fallback Stabilization

- Essential Spiritkin video failures for `idle` or `speaking` now mark that Spiritkin as video-unavailable for the current runtime session.
- Once marked unavailable, the UI stops trying to render video for that Spiritkin and falls back to still-image presentation.
- Failure-triggered rerender is queued once so the UI can settle into the fallback state instead of repeatedly retrying missing media.

### Games Shell Authority

- Added explicit Games-shell structural classes in the bonded chat view:
  - `world-shell-body.games-primary-layout`
  - `presence-panel.is-primary-surface`
  - `chat-stage.is-secondary-surface`
  - `chat-stage-games-rail`
- Added final CSS overrides so the Games room primary surface keeps z-index/layout authority and the sticky secondary rail stays secondary.
- Scoped the Games content area to prevent horizontal spill and to keep the active game board/container above decorative or secondary shell layers.

## Validation

### Syntax

- `node --check spiritkins-app/app.js` — passed
- `node --check spiritkins-app/spiritverse-games.js` — passed

### Runtime / Endpoint Safety

- `node scripts/endpoint-diagnostics.mjs` — passed `31/31`
- `/v1/interact` returned `200`
- No backend route regression was introduced by this frontend pass

## Remaining Issues / Limits

- Live browser confirmation is still required for:
  - repeated blink/render behavior actually stopping in production
  - Games room no longer appearing behind the right panel in the live shell
  - Kairo missing idle/speaking video 404s settling after first failure instead of repeating
- The underlying Kairo idle/speaking files are still missing. This pass stabilizes fallback behavior; it does not create new video assets.
- Existing non-blocking backend warnings remain unchanged:
  - module type warning in `spiritkins-app/package.json`
  - no image generation provider configured
  - no video generation provider configured
