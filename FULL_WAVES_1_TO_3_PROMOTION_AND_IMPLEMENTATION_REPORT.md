# Full Waves 1 To 3 Promotion And Implementation Report

## Scope

This pass processed all current wave folders that had been staged under:

- `Spiritverse_MASTER_ASSETS/INCOMING/spiritverse_wave1_asset_pack`
- `Spiritverse_MASTER_ASSETS/INCOMING/wave2_assets`
- `Spiritverse_MASTER_ASSETS/INCOMING/wave3_premium_assets`

Runtime remains anchored to:

- `Spiritverse_MASTER_ASSETS/ACTIVE`
- `/app/active-assets/*`

No runtime references were added to `ARCHIVE`.

## Wave Classification

### Wave 1: `spiritverse_wave1_asset_pack`

Classification:

- Runtime-usable now: `0`
- Support/shell/reference only: `8`
- Archive only: `8`
- Duplicate of existing ACTIVE asset: `0`

Contents:

- `fx/fx_set_v1.png`
- `pieces/checkers/checkers_set_v1.png`
- `pieces/chess/chess_set_v1.png`
- `ships/battleship/battleship_markers_v1.png`
- `tokens/connect4/connect4_tokens_v1.png`
- `tokens/go/go_stones_v1.png`
- `tokens/tictactoe/tictactoe_tokens_v1.png`
- `ui/ui_elements_v1.png`

Disposition:

- archived as unsliced multi-asset sheets
- not promoted because they are not safe for honest direct runtime use without a slicing/curation pass

### Wave 2: `wave2_assets`

Classification:

- Runtime-usable now: `0`
- Support/shell/reference only: `0`
- Archive only: `23`
- Duplicate of existing ACTIVE asset: `23`

Contents were lower-quality or smaller isolated duplicates of assets already available from wave3 or current ACTIVE.

Disposition:

- archived completely
- not promoted because wave3 equivalents were the stronger current source

### Wave 3: `wave3_premium_assets`

Classification:

- Runtime-usable now: `23`
- Support/shell/reference only: `12`
- Archive only: `0`
- Duplicate of existing ACTIVE asset: `0`

Promoted into ACTIVE:

- Checkers:
  - `ACTIVE/pieces/checkers_piece_light_single_v3.png`
  - `ACTIVE/pieces/checkers_piece_dark_single_v3.png`
- Connect Four:
  - `ACTIVE/tokens/connect4_disc_blue_single_v3.png`
  - `ACTIVE/tokens/connect4_disc_purple_single_v3.png`
  - `ACTIVE/tokens/connect4_disc_gold_single_v3.png`
- Go:
  - `ACTIVE/tokens/go_stone_white_single_v3.png`
  - `ACTIVE/tokens/go_stone_black_single_v3.png`
- Tic Tac Toe:
  - `ACTIVE/tokens/tictactoe_x_single_v3.png`
  - `ACTIVE/tokens/tictactoe_o_single_v3.png`
- Battleship:
  - `ACTIVE/ships/battleship_hit_marker_v3.png`
  - `ACTIVE/ships/battleship_miss_marker_v3.png`
- Chess support singles:
  - `ACTIVE/pieces/chess_white_king_single_v3.png`
  - `ACTIVE/pieces/chess_white_queen_single_v3.png`
  - `ACTIVE/pieces/chess_white_rook_single_v3.png`
  - `ACTIVE/pieces/chess_white_bishop_single_v3.png`
  - `ACTIVE/pieces/chess_white_knight_single_v3.png`
  - `ACTIVE/pieces/chess_white_pawn_single_v3.png`
  - `ACTIVE/pieces/chess_dark_king_single_v3.png`
  - `ACTIVE/pieces/chess_dark_queen_single_v3.png`
  - `ACTIVE/pieces/chess_dark_rook_single_v3.png`
  - `ACTIVE/pieces/chess_dark_bishop_single_v3.png`
  - `ACTIVE/pieces/chess_dark_knight_single_v3.png`
  - `ACTIVE/pieces/chess_dark_pawn_single_v3.png`

Disposition:

- all wave3 usable isolated assets were promoted into ACTIVE
- the wave folder itself was then archived

## Runtime Implementation

### Chess

Active runtime paths in use:

- `ACTIVE/boards/chess_board_lyra_base.png`
- `ACTIVE/rooms/room_chess_lyra_celestial_scene.png`
- `ACTIVE/pieces/chess_pieces_set.png`
- `ACTIVE/pieces/chess_piece_lineup_alt_v2.png`
- `ACTIVE/fx/move_highlight_ring_blue_v1.png`
- `ACTIVE/ui/your_move_banner_v2.png`
- `ACTIVE/ui/spiritkin_thinking_banner_v1.png`
- `ACTIVE/ui/generic_you_won_banner_large.png`
- `ACTIVE/ui/generic_you_lost_banner_large.png`
- `ACTIVE/ui/chess_check_banner.png`
- `ACTIVE/ui/chess_checkmate_banner.png`
- `ACTIVE/ui/modal_frame_premium.png`

Support/shell only:

- all `ACTIVE/pieces/chess_*_single_v3.png` files were promoted as current support assets
- they were not forced into direct board-piece runtime because the existing SVG chess renderer is still clearer and safer for live play

### Checkers

Active runtime paths in use:

- `ACTIVE/boards/checkers_board_dragonforge_base.png`
- `ACTIVE/rooms/room_checkers_dragonforge_scene.png`
- `ACTIVE/pieces/checkers_piece_light_single_v3.png`
- `ACTIVE/pieces/checkers_piece_dark_single_v3.png`
- `ACTIVE/pieces/checkers_piece_set_alt_v2.png`
- `ACTIVE/pieces/checkers_pieces_set.png`
- `ACTIVE/fx/move_highlight_ring_gold_v2.png`
- `ACTIVE/ui/checkers_you_won_banner.png`
- `ACTIVE/ui/checkers_you_lost_banner.png`
- `ACTIVE/ui/modal_frame_premium.png`

### Connect Four

Active runtime paths in use:

- `ACTIVE/boards/connect4_board_waterfall_base.png`
- `ACTIVE/rooms/room_connect4_waterfall_scene.png`
- `ACTIVE/tokens/connect4_disc_blue_single_v3.png`
- `ACTIVE/tokens/connect4_disc_purple_single_v3.png`
- `ACTIVE/tokens/connect4_disc_gold_single_v3.png`
- `ACTIVE/tokens/connect4_disc_set_v1.png`
- `ACTIVE/fx/portal_beam_fx_blue_v1.png`
- `ACTIVE/ui/your_move_banner_v2.png`
- `ACTIVE/ui/spiritkin_thinking_banner_v1.png`
- `ACTIVE/ui/generic_you_won_banner_large.png`
- `ACTIVE/ui/generic_you_lost_banner_large.png`
- `ACTIVE/ui/modal_frame_premium.png`

### Battleship

Active runtime paths in use:

- `ACTIVE/boards/battleship_grid_premium_placeholder.svg`
- `ACTIVE/rooms/room_battleship_forge_scene.png`
- `ACTIVE/ships/battleship_ship_set_v2.png`
- `ACTIVE/ships/battleship_forge_ships_set.png`
- `ACTIVE/ships/battleship_hit_marker_v3.png`
- `ACTIVE/ships/battleship_miss_marker_v3.png`
- `ACTIVE/fx/portal_beam_fx_blue_v1.png`
- `ACTIVE/ui/your_move_banner_v2.png`
- `ACTIVE/ui/spiritkin_thinking_banner_v1.png`
- `ACTIVE/ui/generic_you_won_banner_large.png`
- `ACTIVE/ui/generic_you_lost_banner_large.png`
- `ACTIVE/ui/modal_frame_premium.png`

### Tic Tac Toe

Active runtime paths in use:

- `ACTIVE/concepts/spiritverse_tictactoe_forest_theme.png`
- `ACTIVE/rooms/room_tictactoe_forest_scene.png`
- `ACTIVE/tokens/tictactoe_x_single_v3.png`
- `ACTIVE/tokens/tictactoe_o_single_v3.png`
- `ACTIVE/tokens/tictactoe_token_set_v1.png`
- `ACTIVE/tokens/tictactoe_tokens_forest_set.png`
- `ACTIVE/fx/tictactoe_glow_marks.png`
- `ACTIVE/ui/your_move_banner_v2.png`
- `ACTIVE/ui/spiritkin_thinking_banner_v1.png`
- `ACTIVE/ui/generic_you_won_banner_large.png`
- `ACTIVE/ui/generic_you_lost_banner_large.png`
- `ACTIVE/ui/modal_frame_premium.png`

### Go Preview

Active runtime paths in use:

- `ACTIVE/boards/go_board_aquatic_base.png`
- `ACTIVE/rooms/room_go_aquatic_scene.png`
- `ACTIVE/tokens/go_stone_white_single_v3.png`
- `ACTIVE/tokens/go_stone_black_single_v3.png`
- `ACTIVE/tokens/go_stones_set_v2.png`
- `ACTIVE/tokens/go_stone_layout_preview_v1.png`
- `ACTIVE/fx/move_highlight_ring_gold_v2.png`
- `ACTIVE/ui/your_move_banner_v2.png`
- `ACTIVE/ui/spiritkin_thinking_banner_v1.png`
- `ACTIVE/ui/generic_you_won_banner_large.png`
- `ACTIVE/ui/generic_you_lost_banner_large.png`
- `ACTIVE/ui/modal_frame_premium.png`

Go remains preview-only and is still not presented as a completed live game.

## What Was Support Or Shell Only

- wave1 sheets were archived as reference/slicing candidates only
- chess wave3 isolated singles were promoted as support assets, not direct runtime board replacements
- existing concept and room art remains shell framing in Battleship and Tic Tac Toe where a direct isolated final board asset is still not strong enough

## What Was Archived

Archived under:

- `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/spiritverse_wave1_asset_pack`
- `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/wave2_assets`
- `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/wave3_premium_assets`

Reasons:

- wave1: unsliced multi-asset sheets
- wave2: lower-quality duplicates relative to wave3
- wave3: fully consumed and then archived after promotion

## What Still Needs A Future Visual Wave

- truly isolated final chess piece runtime integration if the team wants to replace the SVG renderer without hurting readability
- a final premium Battleship tactical board package that goes beyond shell/frame support
- a cleaner isolated Tic Tac Toe board package instead of concept-shell dependence
- sliced production-ready wave1 sheet assets if those sheets contain valuable UI/fx material worth extracting later
- any future SpiritGate/theme-layer asset work should still route through ACTIVE only

## ACTIVE Manifest Update

Updated:

- `ACTIVE/manifest/asset_index.json`

The ACTIVE index now includes the full wave3 promoted asset set.

## Incoming Status

`INCOMING` is now clean.

- no processed wave folders remain in `INCOMING`
- all three waves were classified and moved out
