# Chess Showcase Implementation Notes

## Scope

This pass upgrades Chess only, using the canonical `Spiritverse_MASTER_ASSETS/ACTIVE` pipeline. No `ARCHIVE` paths are referenced at runtime.

## ACTIVE asset paths used

- `Spiritverse_MASTER_ASSETS/ACTIVE/boards/chess_board_lyra_base.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/room_chess_lyra_celestial_scene.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/chess_pieces_set.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/chess_piece_lineup_alt_v2.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/your_move_banner_v2.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/spiritkin_thinking_banner_v1.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/chess_check_banner.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/chess_checkmate_banner.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/generic_you_won_banner_large.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/generic_you_lost_banner_large.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/ui/modal_frame_premium.png`
- `Spiritverse_MASTER_ASSETS/ACTIVE/fx/move_highlight_ring_blue_v1.png`

## Used directly

- `boards/chess_board_lyra_base.png` as the canonical chess board surface
- `rooms/room_chess_lyra_celestial_scene.png` as the premium room/backdrop layer
- `ui/your_move_banner_v2.png` for player-turn acknowledgment
- `ui/spiritkin_thinking_banner_v1.png` for AI thinking state
- `ui/chess_check_banner.png` for live chess danger-state acknowledgment where the frontend can confidently infer it
- `ui/chess_checkmate_banner.png` for checkmate outcome presentation
- `ui/modal_frame_premium.png` for board containment and premium framing
- `fx/move_highlight_ring_blue_v1.png` for move/board FX layering

## Used as supporting layer

- `pieces/chess_pieces_set.png` as a premium shell accent layer
- `pieces/chess_piece_lineup_alt_v2.png` as supporting shell chrome

Gameplay readability still comes first, so the actual interactive chess pieces remain the current inline SVG piece set.

## What is still temporary

- Piece rendering still uses the existing inline SVG per-piece system rather than isolated production chess sprites from the ACTIVE pack.
- Check detection for banner presentation is still limited to outcomes and frontend-visible textual cues, because there is not yet a dedicated runtime chess-status field for live check state.
- The premium piece-sheet assets are used as environmental/supporting layers, not sliced into individual in-board piece sprites.

## Next isolated chess assets that would improve the showcase

- Transparent white and black piece sprites by piece type
- Dedicated selected-square, valid-move, capture, and last-move overlays
- A purpose-cut large chess board base sized for fullscreen and in-panel play
- Dedicated chess win/loss banners to complement the existing check/checkmate set
- Chess-specific sidebar art or move-history ornament layers
