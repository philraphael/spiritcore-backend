# Wave 4A Promotion And Implementation Report

## Scope

Processed source:

- `Spiritverse_MASTER_ASSETS/INCOMING/wave4a_production_assets`

Canonical runtime destination:

- `Spiritverse_MASTER_ASSETS/ACTIVE`

Wave 4A was treated as a production-ready separated pack, but the supplied manifest and missing-assets notes make clear that many files are still family/group crops rather than true final isolated runtime sprites.

## Promoted Assets

Promoted into ACTIVE:

### Pieces

- `ACTIVE/pieces/chess_white_piece_family_v4a.png`
- `ACTIVE/pieces/chess_dark_piece_family_v4a.png`
- `ACTIVE/pieces/checkers_piece_family_v4a.png`

### Tokens

- `ACTIVE/tokens/connect4_disc_family_v4a.png`
- `ACTIVE/tokens/tictactoe_token_family_v4a.png`
- `ACTIVE/tokens/go_stone_family_v4a_left.png`
- `ACTIVE/tokens/go_stone_family_v4a_right.png`

### Ships

- `ACTIVE/ships/battleship_ship_family_v4a.png`

### FX

- `ACTIVE/fx/chess_overlay_set_v4a.png`
- `ACTIVE/fx/checkers_move_marker_v4a.png`
- `ACTIVE/fx/connect4_fx_family_v4a.png`
- `ACTIVE/fx/battleship_marker_family_v4a.png`
- `ACTIVE/fx/go_ring_overlay_family_v4a.png`

### UI

- `ACTIVE/ui/shared_ui_banner_set_v4a.png`

Total promoted assets: `14`

## What Was Used Directly

Used directly in current live runtime as support-safe assets:

- `ACTIVE/fx/chess_overlay_set_v4a`
  - now used as the chess shell/board chrome overlay set
- `ACTIVE/fx/checkers_move_marker_v4a`
  - now used as the checkers selection/move-marker overlay
- `ACTIVE/fx/connect4_fx_family_v4a`
  - now used as the connect-four board chrome/drop-trail support overlay
- `ACTIVE/fx/battleship_marker_family_v4a`
  - now used as the battleship support-layer sonar/marker overlay
- `ACTIVE/fx/go_ring_overlay_family_v4a`
  - now used as the Go preview ring/hoshi overlay support

## What Was Used As Shell Or Support Only

Used as shell/support art, not as direct isolated gameplay sprite replacements:

- `ACTIVE/pieces/chess_white_piece_family_v4a.png`
  - used as chess shell accent art
- `ACTIVE/pieces/chess_dark_piece_family_v4a.png`
  - used as chess support-layer card/shell art
- `ACTIVE/pieces/checkers_piece_family_v4a.png`
  - used as checkers shell accent support while isolated v3 singles remain the real live pieces
- `ACTIVE/tokens/connect4_disc_family_v4a.png`
  - used as connect-four shell accent support while isolated v3 discs remain the direct runtime pieces
- `ACTIVE/ships/battleship_ship_family_v4a.png`
  - used as battleship shell support art while the tactical grid remains readable
- `ACTIVE/tokens/tictactoe_token_family_v4a.png`
  - used as tic-tac-toe shell support art while isolated X/O v3 assets remain the direct runtime marks
- `ACTIVE/tokens/go_stone_family_v4a_left.png`
  - used as Go preview shell support art
- `ACTIVE/tokens/go_stone_family_v4a_right.png`
  - used as Go preview accent support art

Promoted but not used directly in runtime yet:

- `ACTIVE/ui/shared_ui_banner_set_v4a.png`
  - kept in ACTIVE because it is a valid separated Wave 4A UI support asset
  - not wired into live runtime because it is still a grouped banner crop rather than one-file-per-banner/modal asset, and forcing it into the UI chrome would reduce clarity

## Exact Per-Game Replacements Or Additions

### Chess

Added:

- `ACTIVE/pieces/chess_white_piece_family_v4a.png`
- `ACTIVE/pieces/chess_dark_piece_family_v4a.png`
- `ACTIVE/fx/chess_overlay_set_v4a.png`

Runtime effect:

- chess shell/chrome now uses Wave 4A family and overlay support art
- direct board-piece runtime remains the existing SVG system because Wave 4A still lacks isolated per-piece files

### Checkers

Added:

- `ACTIVE/pieces/checkers_piece_family_v4a.png`
- `ACTIVE/fx/checkers_move_marker_v4a.png`

Runtime effect:

- checkers shell accent and move-marker overlay now use Wave 4A
- direct light/dark checker pieces remain the clearer isolated v3 singles

### Connect Four

Added:

- `ACTIVE/tokens/connect4_disc_family_v4a.png`
- `ACTIVE/fx/connect4_fx_family_v4a.png`

Runtime effect:

- connect-four shell chrome and FX layer now use Wave 4A
- direct blue/purple/gold disc runtime remains the clearer isolated v3 singles

### Battleship

Added:

- `ACTIVE/ships/battleship_ship_family_v4a.png`
- `ACTIVE/fx/battleship_marker_family_v4a.png`

Runtime effect:

- battleship shell framing and marker overlay now use Wave 4A support art
- direct readable tactical grid and isolated hit/miss markers remain intact

### Tic Tac Toe

Added:

- `ACTIVE/tokens/tictactoe_token_family_v4a.png`

Runtime effect:

- tic-tac-toe shell support art now uses Wave 4A
- direct X/O runtime remains the clearer isolated v3 singles

### Go Preview

Added:

- `ACTIVE/tokens/go_stone_family_v4a_left.png`
- `ACTIVE/tokens/go_stone_family_v4a_right.png`
- `ACTIVE/fx/go_ring_overlay_family_v4a.png`

Runtime effect:

- Go preview shell/accent/ring overlay now uses Wave 4A support assets
- direct white/black stone runtime remains the clearer isolated v3 singles

## What Still Remains Missing For A True Final Premium Pass

Per the supplied Wave 4A docs, still missing:

- Chess: isolated per-piece sprites for both sides
- Checkers: isolated regular and king sprites by color
- Connect Four: isolated disc colors and isolated overlay files
- Battleship: isolated per-ship and per-marker assets
- Tic Tac Toe: isolated X/O plus hover variants
- Go: isolated black/white stones plus pass/capture overlays
- Shared UI: one-file-per-banner and one-file-per-modal asset set

## Incoming / Archive Status

Wave 4A has been fully processed for this pass.

- promoted usable files into ACTIVE
- archived the intake folder to:
  - `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/wave4a_production_assets`

`INCOMING` is clean after this pass.
