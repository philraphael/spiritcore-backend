# Current Asset Implementation Report

## Scope

This pass reviewed the current canonical asset pipeline under:

- `C:\spiritcore-backend\Spiritverse_MASTER_ASSETS\ACTIVE`
- `C:\spiritcore-backend\Spiritverse_MASTER_ASSETS\INCOMING`

Only ACTIVE is used by runtime after this pass. Selected wave3 isolated assets were promoted from INCOMING into ACTIVE under stable names for current live use.

## Runtime Consolidation

Current runtime asset references are consolidated through:

- `server.mjs`
- `spiritkins-app/data/gameAssetManifest.js`
- `spiritkins-app/spiritverse-games.js`
- `spiritkins-app/spiritverse-games.css`

No live runtime references were left pointed at ARCHIVE. Runtime remains served from `/app/active-assets/*`.

## Promoted From INCOMING To ACTIVE

Promoted isolated assets:

- `ACTIVE/pieces/checkers_piece_light_single_v3.png`
- `ACTIVE/pieces/checkers_piece_dark_single_v3.png`
- `ACTIVE/tokens/connect4_disc_blue_single_v3.png`
- `ACTIVE/tokens/connect4_disc_purple_single_v3.png`
- `ACTIVE/tokens/connect4_disc_gold_single_v3.png`
- `ACTIVE/tokens/go_stone_white_single_v3.png`
- `ACTIVE/tokens/go_stone_black_single_v3.png`
- `ACTIVE/tokens/tictactoe_x_single_v3.png`
- `ACTIVE/tokens/tictactoe_o_single_v3.png`
- `ACTIVE/ships/battleship_hit_marker_v3.png`
- `ACTIVE/ships/battleship_miss_marker_v3.png`

These were chosen because they are isolated single-runtime assets that improve live readability immediately without requiring a slicing/tooling pass.

## Per-Game Runtime Usage

### Chess

Direct runtime assets:

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

Support-layer only:

- chess still uses the current inline SVG runtime piece renderer because it is clearer and more stable than swapping to unsliced image pieces mid-pass

### Checkers

Direct runtime assets:

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

Support-layer only:

- `ACTIVE/pieces/checkers_piece_set_alt_v2.png` remains the support sheet for shell/accent use and king continuity

### Connect Four

Direct runtime assets:

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

Support-layer only:

- `ACTIVE/tokens/connect4_disc_set_v1.png` remains the accent/sheet support image

### Battleship

Direct runtime assets:

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

Support-layer only:

- forge room art and ship sheets remain support/framing layers around the live tactical grid

### Tic Tac Toe

Direct runtime assets:

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

Support-layer only:

- concept scene and token sheet still provide shell/theme support around the direct X/O singles

### Go

Direct runtime assets:

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

Support-layer only:

- stone sheet/layout preview still support the premium preview shell

Go remains intentionally preview-only in runtime.

## Functional Improvements

- token-driven games now use canonical isolated ACTIVE singles instead of older support-only sheets where current live rendering benefits from them
- Checkers now reads with clearer light/dark single-piece treatment
- Connect Four now uses promoted single-disc ACTIVE tokens with clearer runtime identity
- Tic Tac Toe now uses promoted X/O singles for live mark presence
- Go preview now uses promoted black/white singles while staying truthful about preview status
- Battleship now has promoted hit/miss marker assets available in the canonical runtime pipeline
- runtime remains centered around the existing stable interaction flow rather than scattered asset roots

## Remaining Placeholder Or Support-Layer Usage

- Chess still relies on inline SVG pieces for live play clarity
- Battleship still uses support-layer room/ship art around a CSS/tactical grid rather than a fully isolated premium board package
- Tic Tac Toe still uses concept art as the board shell because there is not yet a cleaner isolated final board asset
- Go remains preview-only because gameplay completion is still intentionally constrained
- wave1 sheets and unsliced larger packs remain in INCOMING because they need a separate slicing/curation pass before honest live use

## Remaining Runtime Limitations

- some newly promoted assets are used as shell/support augmentation rather than full renderer replacement
- a future asset pass should update `ACTIVE/manifest/asset_index.json` with the newly promoted filenames if the asset registry needs to be exhaustive for operators
- chess image-piece runtime conversion is deferred because the current SVG renderer is still the safer live experience
