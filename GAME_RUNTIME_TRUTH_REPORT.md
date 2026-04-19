# Game Runtime Truth Report

Date: 2026-04-19

Scope:
- Reviewed current exposed game list in the frontend hub and backend game registry.
- Inspected runtime paths in [src/routes/games.mjs](/abs/path/C:/spiritcore-backend/src/routes/games.mjs:1), [src/services/gameEngine.mjs](/abs/path/C:/spiritcore-backend/src/services/gameEngine.mjs:1), [src/services/sharedGameEngine.mjs](/abs/path/C:/spiritcore-backend/src/services/sharedGameEngine.mjs:1), [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:5086), and [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:651).
- Ran the available backend runtime check: `node scripts/game-completion-test.mjs` and it passed.

Important truth:
- The backend game engine is materially more complete than the embedded frontend game surface.
- Most games are startable and have backend move logic.
- Several frontend boards are effectively preview surfaces in the main bonded UI because inline click binding is missing outside Grand Stage.

## Summary Matrix

| Game | Enter It | User Move | AI Responds | Visual Update | Turn Advances | Normal End State | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Celestial Chess | Yes | Yes, but effectively through Grand Stage | Yes | Yes | Yes | Yes | Partially playable |
| Veil Checkers | Yes | Yes, but effectively through Grand Stage | Unreliable | Yes | Partial | No reliable completion | AI turn broken, end-state broken |
| Star-Mapping (Go) | Yes | Yes, but effectively through Grand Stage | Yes | Yes | Yes | No normal completion logic | End-state broken, demo-only feeling |
| Spirit-Cards | Yes | Yes, but effectively through Grand Stage | Yes | Yes | Yes | Yes | Partially playable |
| Echo Trials | Yes | Yes inline | N/A in board-move sense | Yes | Yes | Yes | Fully playable |
| TicTacToe of Echoes | Yes | Yes, but effectively through Grand Stage | Yes | Yes | Yes | Yes | Partially playable |
| Connect Four Constellations | Yes | Yes, but effectively through Grand Stage | Yes | Yes | Yes | Yes | Partially playable |
| Abyssal Battleship | Yes | Yes, but effectively through Grand Stage | Yes | Yes | Yes | Yes | Partially playable |

## Per-Game Findings

### Celestial Chess

Status: `partially playable`

What works:
- Backend move application, spirit reply generation, canonical persistence, and end-state detection exist.
- The shared runtime includes legal move generation and checkmate or stalemate handling.
- The main app only accepts backend-canonical game state after move submission.

What is reduced:
- The inline board is not truly first-class interactive. In the renderer, board square click binding only occurs in expanded mode:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:352)
- The in-page board therefore behaves more like a preview plus “Grand Stage” launcher.

Truth classification:
- Can reach a normal end state.
- Not visually broken.
- Not fully smooth in the main surface.

### Veil Checkers

Status: `AI turn broken`, `end-state broken`, `partially playable`

What works:
- Game can start.
- User move application exists.
- Visual board renderer exists.

What is broken:
- The fallback Spiritkin move is hardcoded to `11-15`:
  - [src/services/sharedGameEngine.mjs](/abs/path/C:/spiritcore-backend/src/services/sharedGameEngine.mjs:144)
- That move is not generally valid for the Spiritkin side and can fail depending on state.
- Checkers move logic does not include kinging, win detection, or full completion handling:
  - [src/services/sharedGameEngine.mjs](/abs/path/C:/spiritcore-backend/src/services/sharedGameEngine.mjs:280)
- Inline board interactivity is again effectively gated to Grand Stage:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:427)

Truth classification:
- The exposed game is not complete enough to call fully playable.
- AI response can exist as commentary, but AI move resolution is structurally unreliable.
- Normal end state is missing.

### Star-Mapping (Go)

Status: `end-state broken`, `demo-only feeling`, `partially playable`

What works:
- Game can start.
- User and Spiritkin stone placement logic exists.
- Visual board renderer exists.
- Fallback Spiritkin move `G7` is valid as an opening-style answer if unoccupied.

What is broken or incomplete:
- There is no scoring, passing, capture resolution, territory calculation, or real game completion.
- `applyGoMove()` only places stones and never reaches a normal finished result:
  - [src/services/sharedGameEngine.mjs](/abs/path/C:/spiritcore-backend/src/services/sharedGameEngine.mjs:351)
- Inline board click binding is only attached in expanded mode:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:498)

Truth classification:
- This is a presentable board interaction, not a complete Go runtime.

### Spirit-Cards

Status: `partially playable`

What works:
- Start, draw, play-card, AI move selection, and realm-point win condition exist.
- Backend draw route exists and maps to the same canonical move path.
- State progression and result handling exist.

What is reduced:
- Main-surface card buttons bind only in expanded mode:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:901)
- In the normal bonded page, the game can therefore look rendered but not directly interactive until Grand Stage is opened.

Truth classification:
- Core runtime exists.
- UX makes it feel less direct than it should.

### Echo Trials

Status: `fully playable`

What works:
- Inline input, submit flow, attempt counting, answer check, and loss or success states exist.
- The board does not depend on a Spiritkin “piece move,” so lack of a board-style AI move is not a defect here.
- The answer input is wired inline, not only in Grand Stage:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:961)

Truth classification:
- Simple, but complete enough for its intended loop.

### TicTacToe of Echoes

Status: `partially playable`

What works:
- Start, move submission, AI response, line win detection, and draw detection exist.
- Backend test coverage confirms win and draw handling.

What is reduced:
- Inline cell click binding only occurs in expanded mode:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:991)
- This means the main bonded games panel is not the true authoritative interaction surface for TicTacToe, even though it visually appears to be.

Truth classification:
- The canonical engine is good.
- The embedded UX is still half-preview, half-game.

### Connect Four Constellations

Status: `partially playable`

What works:
- Start, drop, AI fallback move, visual token placement, win detection, and draw detection exist.
- Backend test coverage confirms win and draw handling.

What is reduced:
- Inline column click binding only occurs in expanded mode:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:1070)

Truth classification:
- Strong backend loop.
- Main-surface interactivity is still degraded.

### Abyssal Battleship

Status: `partially playable`

What works:
- Start, guess submission, hit or miss tracking, AI fallback guesses, and fleet-clear completion exist.
- Backend test coverage confirms user win handling.

What is reduced:
- Inline cell click binding only occurs in expanded mode:
  - [spiritkins-app/spiritverse-games.js](/abs/path/C:/spiritcore-backend/spiritkins-app/spiritverse-games.js:1098)

Truth classification:
- Playable via the expanded overlay.
- Less reliable as an in-page game surface than it appears.

## Runtime Truth Conclusions

Actually broken right now:
- Checkers AI fallback and checkers completion logic.
- Go completion logic.
- Inline interaction parity across most boards.

Actually healthy right now:
- Backend canonical game commit pattern for the games already covered by the runtime test.
- TicTacToe, Connect Four, Battleship, Spirit-Cards, Chess end-state handling on the backend.
- Echo Trials as a compact full loop.

Demo-only or reduced-feel issues:
- Most main-page boards visually render but behave like previews until expanded.
