# FINAL GAMES LAYOUT WIDTH FIX

## Layout Root Cause

The active board was no longer missing. It was being mounted inside a Games surface that was still inheriting the outer `chat-layout.game-focus-mode` two-column grid.

That meant:

- the chat rail was already removed from the DOM for the active Games surface
- but the root layout still reserved a narrow second column
- `world-shell-body` and the active game panel were being placed into that constrained track
- the board mounted successfully into a container that was only about `98px` wide in live browser output

## Fix Applied

### Layout authority

Added a dedicated active-games root class in `spiritkins-app/app.js`:

- `games-room-active`

This class is applied only when:

- `activePresenceTab === "games"`
- `activeGame` exists

### CSS sizing fix

In `spiritkins-app/styles.css`:

- forced `.chat-layout.games-room-active` to a single-column layout
- forced `.world-shell-body` to a single-column layout during active game mode
- kept the active game surface as the primary visible content area
- widened and centered:
  - `.active-game-panel`
  - `.sv-theme-shell`
  - `.game-board-container`
- ensured mobile/fold layouts use a stacked narrower board width instead of a squeezed rail column

## Render Spam Guard

In `spiritkins-app/app.js`:

- added `_lastRenderedActiveGameSignature`
- the board now skips mount scheduling and skips re-rendering when the same game state is already mounted into the current board container
- re-render still occurs when the game state actually changes

Signature fields:

- game id
- type
- status
- turn
- moveCount
- history length

## Validation

Run locally:

- `node --check spiritkins-app/app.js`
- `node --check spiritkins-app/spiritverse-games.js`
- `node scripts/endpoint-diagnostics.mjs`

## Remaining Limitation

Live browser verification is still required to confirm:

- the board is visually large and centered
- `containerWidth` and `boardStageWidth` are no longer rail-sized
- repeated `[Games] mount-scheduled` / `[Games] render success` spam stays quiet after stable load
