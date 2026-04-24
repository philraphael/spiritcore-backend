# BM-V2 Board And Gate Video Stability Report

## Scope
- Branch: `feature/bond-manager-mode-v2`
- Focus: game board mount stability and Crown Gate video load stability
- Explicitly untouched: bond manager V2 flow logic, backend intelligence, database

## Board Root Cause
- The active game board mount in `spiritkins-app/app.js` was a one-shot `requestAnimationFrame` render.
- After the recent render scheduling hardening, that path could fire before `#spiritverse-game-board` or its parent board stage had measurable layout width.
- When that happened, `SpiritverseGames.render(...)` had no ready board target and there was no retry, so the board appeared not to load.

## Board Fix
- Replaced the one-shot inline board render with:
  - `scheduleActiveGameBoardMount()`
  - `mountActiveGameBoard(runId, attempt)`
- Behavior:
  - only runs when Games is the active presence surface
  - waits until after render completes
  - mounts against the actual board element node
  - retries one additional animation frame if the container is still missing or widthless
  - uses a run-id guard so stale mount attempts cannot loop or mount into an obsolete render

## Gate Video Root Cause
- `syncEntryCinematics()` was resetting the gate preview video to `currentTime = 0` on repeated sync passes while the entry gate was visible.
- That made the preview feel intermittent or slow because the video could keep getting re-primed instead of settling into poster/metadata-first loading.

## Gate Video Improvement
- Gate preview videos now default to `preload="metadata"` in entry markup.
- While the gate is only being previewed:
  - the poster remains immediately visible
  - the video is primed once via `data-preview-primed`
  - repeated sync passes no longer keep rewinding the preview video
- When the user actually starts the gate sequence:
  - preload is promoted to `auto`
  - the existing playback and fallback flow still runs
- The Enter / Continue action remains independent of video readiness.

## Files Changed
- `spiritkins-app/app.js`

## Diagnostics
- `node --check spiritkins-app/app.js` passed
- `node --check spiritkins-app/spiritverse-games.js` passed
- `node scripts/endpoint-diagnostics.mjs` passed `31/31`
- `/v1/interact` remained `200`
- `/v1/session/control` remained `200`

## Manual Verification Status
- Browser verification is still required for:
  - gate preview showing poster immediately while video metadata loads
  - Games room visibly mounting the board after navigation
  - confirming no blinking regression and V2 bond manager still behaving cleanly on this branch

## Remaining Issues
- This pass does not add or populate missing video assets.
- If the board still fails in browser after this fix, the next likely issue is game-surface visibility timing inside the Games tab rather than the render scheduler itself.
