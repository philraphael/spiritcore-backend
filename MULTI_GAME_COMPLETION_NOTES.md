# Multi-Game Completion Sprint Phase 1

## Scope

This pass extends the premium game presentation baseline beyond Chess for the current live games:

- Checkers
- Connect Four
- Battleship
- Tic Tac Toe
- Go

The implementation stays on the current runtime and ACTIVE asset pipeline only.

## Per-Game Upgrades

### Checkers

- Added premium focus-panel treatment and dedicated mode hero.
- Added move-origin and move-destination highlighting for the latest committed move.
- Strengthened king presence so crowned pieces read as upgraded pieces instead of normal discs.
- Improved live-match captioning so the board feels active instead of static.

ACTIVE assets used:

- `Spiritverse_MASTER_ASSETS/ACTIVE/boards/checkers_board_base_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/checkers_piece_set_alt_v2.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/checkers_pieces_set.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/room_checkers_dragonforge_scene.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/fx/move_highlight_ring_gold_v2.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/checkers_you_won_banner.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/checkers_you_lost_banner.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/modal_frame_premium.png`

### Connect Four

- Added premium focus-panel treatment and dedicated mode hero.
- Added landing-cell detection from canonical last move so the latest drop reads clearly.
- Added token drop animation and stronger destination highlighting.
- Improved board captioning so AI turns feel deliberate instead of silent.

ACTIVE assets used:

- `Spiritverse_MASTER_ASSETS/ACTIVE/boards/connect4_board_base_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/connect4_disc_blue.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/connect4_disc_purple.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/connect4_disc_darkblue.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/connect4_disc_set_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/room_connect4_waterfall_scene.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/fx/portal_beam_fx_blue_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/modal_frame_premium.png`

### Battleship

- Added premium focus-panel treatment and dedicated mode hero.
- Added scanner/status shell around the strike grid so the play area feels intentional.
- Added explicit hit and miss acknowledgment for the latest committed strike.
- Improved strike-state readability and active-turn framing.

ACTIVE assets used:

- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/spiritverse_battleship_forge_theme.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ships/battleship_ship_set_v2.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ships/battleship_forge_ships_set.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/room_battleship_forge_scene.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/fx/portal_beam_fx_blue_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/modal_frame_premium.png`

### Tic Tac Toe

- Added premium focus-panel treatment and dedicated mode hero.
- Added animated token placement and latest-move emphasis.
- Upgraded quick-play presentation so it feels deliberate instead of placeholder.
- Improved finish-state readability through stronger board and caption treatment.

ACTIVE assets used:

- `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/spiritverse_tictactoe_forest_theme.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/tictactoe_token_set_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/tictactoe_tokens_forest_set.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/room_tictactoe_forest_scene.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/fx/tictactoe_glow_marks.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/modal_frame_premium.png`

### Go

- Kept Go intentionally constrained as a premium preview.
- Added focused preview-panel treatment and dedicated mode hero.
- Preserved explicit truth banner that capture, pass, territory scoring, and final completion are not yet live-complete.
- Did not present Go as fully playable.

ACTIVE assets used:

- `Spiritverse_MASTER_ASSETS/ACTIVE/boards/go_board_aquatic_base.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/go_stones_set_v2.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/go_stone_layout_preview_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/room_go_aquatic_scene.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/fx/move_highlight_ring_gold_v2.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/modal_frame_premium.png`

## Shared UX Upgrades

- Extended the active premium panel treatment beyond Chess so each live game holds center more clearly.
- Reused the stable canonical move path so feedback still depends on backend-committed state.
- Expanded the Spiritkin reply delay treatment from Chess to the other live board games so AI turns register visibly.
- Kept board focus anchored in the existing active game panel flow.

## Completion Truthfulness

Truly complete enough for live play in this pass:

- Checkers
- Connect Four
- Battleship
- Tic Tac Toe

Intentionally constrained:

- Go remains preview-only until capture, pass, scoring, and honest completion are implemented.

## Current Asset Limitations

- Tic Tac Toe still relies on concept art and CSS token rendering instead of isolated final token assets.
- Battleship still uses forge scene/concept framing rather than a fully isolated premium tactical grid art set.
- Checkers uses stronger CSS king treatment because there is not yet an isolated king asset variant.
- Connect Four uses the current disc set effectively, but a dedicated win-line overlay asset would improve the final feel later.
