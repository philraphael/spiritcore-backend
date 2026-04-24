## Final Games Active State Fix Report

Branch: `main`

### Root Cause

The board was not hidden behind layout. It was never being created because the Games view could reopen with a stale backend `gameState` during the Games-tab session transition.

The live failure path was:

1. User opens Games with no intentional active game.
2. Frontend transitions to the Games surface.
3. Backend session-control snapshot can rehydrate a previous `gameState`.
4. Mount scheduling sees a `gameType` from that stale session state.
5. The real Games hub branch and the real board container branch are now out of sync with the intended user flow, so the board mount attempts fire at the wrong time.

That is why live console output could show:

- `[Games] tab activated` with `activeGame: null`
- followed by mount attempts with stale `gameType: chess`
- while `hasContainer: false` and `hasBoardStage: false`

### Exact Fix

#### app.js

- `open-games-hub` now explicitly clears local game state before switching to the Games surface:
  - `state.activeGame = null`
  - `state.gameActive = false`
  - `state.pendingGameType = null`
- `transitionPresenceSurface("games", { preferHub: true })` now treats the Games hub as an explicit no-active-game mode.
- `syncSessionControl(..., { ignoreGameState: true })` is used for that Games-hub transition so stale backend `gameState` is not rehydrated into the UI before the user selects a game.
- `applySessionSnapshot(..., { ignoreGameState })` supports that safe ignore path without changing backend behavior.
- `scheduleActiveGameBoardMount()` now logs and exits cleanly when there is no active game:
  - `[Games] mount-skipped-no-active-game`
- Added clear flow logs:
  - `[Games] hub-rendered`
  - `[Games] start-requested`
  - `[Games] start-success`
  - `[Games] board-container-rendered`

#### Game start flow

- The existing `/v1/games/start` path remains the only real activation path.
- A real board mount is only scheduled after `state.activeGame` is set from the successful start response and the Games view re-renders.

#### manifest.json

- Safe PWA warning cleanup:
  - `start_url` changed from `/app` to `/app/`
  - this aligns `start_url` with `scope: "/app/"`

### Diagnostics

- `node --check spiritkins-app/app.js` passed
- `node --check spiritkins-app/spiritverse-games.js` passed
- `node scripts/endpoint-diagnostics.mjs` passed `31/31`

### Remaining Notes

- Browser verification is still required to truthfully confirm the live visual result:
  - Games hub appears first
  - Clicking Chess starts `/v1/games/start`
  - board container exists
  - board renders visibly
  - no blinking

No backend, PWA logic, bond manager, or voice/wake logic was changed beyond the safe manifest warning correction.
