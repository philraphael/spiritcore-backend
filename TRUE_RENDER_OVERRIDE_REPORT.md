# True Render Override Report

## Scope

This pass replaced the visible gameplay rendering layer while preserving existing move submission and validation logic.

Files changed:

- `spiritkins-app/spiritverse-games.js`
- `spiritkins-app/spiritverse-games.css`

## Per-game rendering change

### Chess

- Board now renders as the primary board image from `ACTIVE/boards/chess_board_lyra_base.png`.
- Click handling still uses the existing 8x8 square grid.
- Generic square fills were overridden so the board art remains the primary visible surface.
- Pieces now render as direct image elements using isolated chess piece assets:
  - `chess-piece-pawn-white.png`
  - `chess-piece-pawn-black.png`
  - `chess-piece-rook-white.png`
  - `chess-piece-rook-black.png`
  - `chess-piece-knight-white.png`
  - `chess-piece-knight-black.png`
  - `chess-piece-bishop-white.png`
  - `chess-piece-bishop-black.png`
  - `chess-piece-queen-white.png`
  - `chess-piece-queen-black.png`
  - `chess-piece-king-white.png`
  - `chess-piece-king-black.png`

### Checkers

- Board now renders from the themed board asset in `ACTIVE/boards/checkers_board_dragonforge_base.png`.
- Hit zones remain aligned to the existing 8x8 layout.
- Generic dark/light square fills were removed from primary visibility.
- Pieces now use direct project assets as the actual visible checkers pieces:
  - `checkers-piece-white.png`
  - `checkers-piece-black.png`
  - `checkers-piece-white-king.png`
  - `checkers-piece-black-king.png`

### Connect Four

- Board container now renders from the themed board image in `ACTIVE/boards/connect4_board_waterfall_base.png`.
- Grid buttons remain the click targets, but the visible board is now asset-driven.
- Tokens now render as real image elements instead of glyph/color-only cells:
  - `connect4_disc_blue_single_v3.png`
  - `connect4_disc_purple_single_v3.png`

### Tic Tac Toe

- Board now renders from the themed board shell in `ACTIVE/concepts/spiritverse_tictactoe_forest_theme.png`.
- Grid buttons remain the click targets.
- Tokens now render as real image elements instead of text:
  - `tictactoe_x_single_v3.png`
  - `tictactoe_o_single_v3.png`

### Battleship

- Board grid now renders over the themed board shell in `ACTIVE/concepts/spiritverse_battleship_forge_theme.png`.
- Grid buttons remain authoritative click targets.
- Hit and miss states now render with project marker assets as actual marker elements:
  - `battleship_hit_marker_v3.png`
  - `battleship_miss_marker_v3.png`
- Old pseudo-element marker dominance was demoted.

### Go Preview

- Preview board now renders from `ACTIVE/boards/go_board_aquatic_base.png`.
- Existing preview-only grid logic remains unchanged.
- Stones now render from real image assets:
  - `go_stone_white_single_v3.png`
  - `go_stone_black_single_v3.png`

## Generic visuals removed or demoted

- Chess generic square fills demoted from primary visibility.
- Checkers generic square fills demoted from primary visibility.
- Connect Four generic cell styling no longer serves as the primary visible board.
- Tic Tac Toe generic tile styling no longer serves as the primary visible board.
- Battleship generic button appearance no longer serves as the primary visible board.

## Alignment notes

- The click model remains grid-based for all games.
- Visual alignment depends on the current ACTIVE board images lining up cleanly with the existing logical grid.
- This pass kept grid math unchanged specifically to avoid move-validation regressions.
- Residual risk:
  - Some board art may not be perfectly authored for exact logical-cell boundaries, especially in concept-shell based games such as Battleship and Tic Tac Toe.

## Assets still missing or still limited

- Chess piece themes now share one direct isolated asset set rather than switching true per-theme piece families.
- Checkers still uses one actual piece family per side with dedicated king overrides, not multiple theme-specific families.
- Battleship still relies on a concept-shell board rather than a perfectly isolated tactical board plate.
- Go remains preview-only and was not expanded into a full live rules pass here.

## Verification completed

- `node --check spiritkins-app/spiritverse-games.js`
- `node --check spiritkins-app/app.js`
- Existence checks for all newly referenced board, piece, token, ship, and stone assets

## Verification not completed

- Full live browser gameplay validation was not completed in this pass.
- This pass verifies syntax and asset resolution locally, but live runtime alignment should still be spot-checked in-browser after deploy.
