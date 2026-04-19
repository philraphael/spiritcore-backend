# Premium SpiritVerse Game Visual Implementation Notes

## Scope

Phase 1 upgrades the live game presentation using the local SpiritVerse premium asset pack and the concept scene pack without changing core game logic. Assets are mapped through the existing frontend game asset manifest so current renders can consume named assets instead of hardcoded placeholders.

## Asset Roots Used

- `Spiritverse_MASTER_ASSETS/spiritverse_premium_game_asset_pack`
- `Spiritverse_MASTER_ASSETS/spiritverse_game_concept_assets/spiritverse_game_concepts`

## Mapping Summary

### Chess

- Board surface: `spiritverse_premium_game_asset_pack/boards/chess_board_lyra_base.png`
- Room backdrop: `spiritverse_game_concept_assets/spiritverse_game_concepts/spiritverse_chess_lyra_theme.png`
- Accent/piece sheet: `spiritverse_premium_game_asset_pack/pieces/chess_pieces_set.png`
- UI banners: `your_move_banner.png`, `spiritkin_thinking_banner.png`, `generic_you_won_banner_large.png`, `generic_you_lost_banner_large.png`, `chess_check_banner.png`, `chess_checkmate_banner.png`
- FX/frame: `move_highlight_ring.png`, `modal_frame_premium.png`

Used directly:
- board base
- room backdrop
- UI banners

Used as temporary themed layer:
- piece sheet as shell chrome/accent rather than isolated per-piece sprites

### Checkers

- Board surface: `boards/checkers_board_dragonforge_base.png`
- Room backdrop: `spiritverse_checkers_dragonforge_theme.png`
- Accent/piece sheet: `pieces/checkers_pieces_set.png`
- UI banners: `checkers_you_won_banner.png`, `checkers_you_lost_banner.png`, plus generic move/thinking/frame assets
- FX/frame: `move_highlight_ring.png`, `modal_frame_premium.png`

Used directly:
- board base
- room backdrop
- win/loss banners

Used as temporary themed layer:
- piece sheet for shell chrome while gameplay keeps readable CSS checker discs

### TicTacToe

- Board/backdrop layer: `spiritverse_tictactoe_forest_theme.png`
- Token sheet: `tokens/tictactoe_tokens_forest_set.png`
- FX: `fx/tictactoe_glow_marks.png`
- UI banners: generic move/thinking/win/loss/frame assets

Used directly:
- concept scene as board/backdrop layer
- generic UI banners

Used as temporary themed layer:
- token sheet and glow sheet as shell accents because isolated X/O renders are not present

### Connect Four

- Board surface: `boards/connect4_board_waterfall_base.png`
- Room backdrop: `spiritverse_connect_four_waterfall_theme.png`
- Tokens: `tokens/connect4_disc_blue.png`, `tokens/connect4_disc_purple.png`, `tokens/connect4_disc_darkblue.png`
- UI banners: generic move/thinking/win/loss/frame assets
- FX: `portal_beam_fx.png`

Used directly:
- board base
- room backdrop
- user/spiritkin token discs in the live grid

Used as temporary themed layer:
- dark blue disc as shell accent

### Battleship

- Board/backdrop layer: `spiritverse_battleship_forge_theme.png`
- Ship sheet: `ships/battleship_forge_ships_set.png`
- UI banners: generic move/thinking/win/loss/frame assets
- FX: `portal_beam_fx.png`

Used directly:
- forge scene as board/backdrop layer
- generic UI banners

Used as temporary themed layer:
- ship sheet as shell chrome because isolated per-ship placements/hit markers are not in the pack

### Go

- Board surface: `boards/go_board_aquatic_base.png`
- Room backdrop: `spiritverse_go_aquatic_theme.png`
- Stone sheet: `tokens/go_stones_set.png`
- UI banners: generic move/thinking/win/loss/frame assets
- FX: `move_highlight_ring.png`

Used directly:
- board base
- room backdrop
- generic UI banners

Used as temporary themed layer:
- stone sheet as shell accent while gameplay keeps readable CSS stones

## Runtime Integration Notes

- Asset serving was extended with two static routes:
  - `/app/premium-game-assets/*`
  - `/app/game-concept-assets/*`
- Existing game manifest/theme-shell plumbing was reused instead of adding a new rendering architecture.
- The active game panel now consumes manifest-backed premium banners/frame assets through CSS variables.
- Connect Four now renders premium token images directly in live cells.

## Current Limitations

- The pack still does not contain isolated transparent chess pieces, checkers kings, tic-tac-toe X/O tokens, battleship markers, or Go stones per side for final per-piece runtime use.
- Several assets remain best suited as premium backdrop or shell-chrome layers rather than exact gameplay sprites.
- Battleship and TicTacToe especially still rely on themed layers more than fully isolated in-board assets.

## Next Asset Improvements Needed Later

- Transparent isolated chess pieces by side and type
- Transparent isolated checkers pieces plus dedicated king crowns
- Clean single-asset tic-tac-toe X and O tokens
- Battleship hit, miss, and ship placement assets
- Separate Go black and white stone renders
- Additional game-specific modal and outcome overlays beyond the current generic banner set
