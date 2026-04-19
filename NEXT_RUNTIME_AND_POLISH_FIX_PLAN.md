# Next Runtime And Polish Fix Plan

Date: 2026-04-19

This is a precise fix order based on current runtime truth, not a wishlist.

## Immediate Blockers

### 1. Make inline game boards truly interactive

Why first:
- This is the biggest gap between what the UI shows and what the user can actually do.
- It affects most exposed games and makes the product feel fake even when backend logic is healthy.

Exact fix:
- Attach move click handlers in non-expanded render paths for:
  - chess
  - checkers
  - go
  - spirit_cards
  - tictactoe
  - connect_four
  - battleship
- Keep Grand Stage as an enhancement, not the only real play surface.

### 2. Repair checkers runtime completion

Why second:
- Checkers is materially incomplete.

Exact fix:
- Replace the invalid hardcoded fallback move.
- Add kinging.
- Add piece-elimination and no-legal-move end-state logic.

### 3. Add real Go completion rules or explicitly reduce scope

Why third:
- The current Go surface is a board demo, not a completed game.

Exact fix:
- Either implement a minimal pass, territory, and scoring closeout.
- Or relabel and constrain it so it is no longer pretending to be a full playable match.

## Core Interaction Fixes

### 4. Re-enable the intended auto voice continuity where safe

Why:
- Voice input exists, but the smoother loop behavior is partly detached.

Exact fix:
- Remove the unconditional early return in `maybeAutoOpenGameMic()`.
- Reintroduce it with the current guardrails already present around audio, loading, and active turn state.
- Verify no duplicate listeners are created.

### 5. Tighten microphone discoverability and permission messaging

Why:
- Voice input is real, but the UX is still thin and browser-dependent.

Exact fix:
- Add a concise first-use explanation near the mic or voice enable button.
- Surface browser support and expected permission behavior before failure.

## Premium Polish Restoration

### 6. Reduce preview-only feel on the games surface

Exact fix:
- Make the inline board the default real board.
- Keep Grand Stage as a richer fullscreen mode.
- Add clearer in-surface feedback for whose turn it is and what input is currently expected.

### 7. Replace visible placeholder art dependencies over time

Exact fix:
- Prioritize final boards or overlays for the most-used games:
  - TicTacToe
  - Connect Four
  - Chess
  - Spirit-Cards

### 8. Thin the safety copy in entry/media flow

Exact fix:
- Preserve fallback timers and blank-state guards.
- Hide or reduce operational-feeling status copy during success paths.

## Safe Deferrals

### 9. Deep returning-user greeting memory

Reason:
- Current repetition issue is mitigated.
- This is a continuity upgrade, not a blocker.

### 10. Broader cross-browser voice strategy

Reason:
- Important, but not the next blocker if Chrome-class browsers are the current target.

## Top 5 Fixes In Exact Order

1. Make inline boards interactive for all rendered games.
2. Repair checkers AI fallback and end-state logic.
3. Implement or constrain Go so it no longer presents as a full unfinished game.
4. Re-enable safe automatic game-turn microphone continuity.
5. Add first-use voice permission and support guidance in the conversation UI.
