# Spiritverse Game Asset Inventory

This inventory tracks the permanent named asset pipeline under `Spiritverse_MASTER_ASSETS/Game_Themes`.

Status meanings:

- `live placeholder source`: a named source file exists, is referenced by the manifest, and can be served at runtime today
- `premium art still needed`: the permanent source slot exists in the manifest, but the final named art file has not been added yet
- `runtime fallback remains active`: the current shipped renderer still depends on existing CSS/SVG/HTML output for functional gameplay

## Chess
- Live placeholder source:
  `boards/chess_board_premium_placeholder.svg`
  `room_backdrops/chess_room_premium_placeholder.svg`
- Premium art still needed:
  `pieces_tokens/chess_pieces_crown_master.svg`
  `pieces_tokens/chess_pieces_veil_master.svg`
  `pieces_tokens/chess_pieces_ember_master.svg`
  `pieces_tokens/chess_pieces_astral_master.svg`
  `pieces_tokens/chess_pieces_abyssal_master.svg`
  `overlays_effects/chess_move_glow_overlay.png`
- Runtime fallback remains active:
  inline board/piece rendering and CSS theme treatment

## Checkers
- Live placeholder source:
  `boards/checkers_board_premium_placeholder.svg`
  `room_backdrops/checkers_room_premium_placeholder.svg`
- Premium art still needed:
  `pieces_tokens/checkers_piece_user_master.png`
  `pieces_tokens/checkers_piece_spiritkin_master.png`
  `pieces_tokens/checkers_piece_king_overlay.png`
  `overlays_effects/checkers_selection_overlay.png`
- Runtime fallback remains active:
  CSS board gradients and checker pieces

## TicTacToe of Echoes
- Live placeholder source:
  `boards/tictactoe_echoes_board_premium_placeholder.svg`
  `room_backdrops/tictactoe_room_premium_placeholder.svg`
- Premium art still needed:
  `pieces_tokens/tictactoe_user_mark_master.svg`
  `pieces_tokens/tictactoe_spiritkin_mark_master.svg`
  `overlays_effects/tictactoe_winline_overlay.svg`
- Runtime fallback remains active:
  CSS board grid and text-mark renderer

## Connect Four
- Live placeholder source:
  `boards/connect_four_board_premium_placeholder.svg`
  `room_backdrops/connect_four_room_premium_placeholder.svg`
- Premium art still needed:
  `pieces_tokens/connect_four_disc_user_master.png`
  `pieces_tokens/connect_four_disc_spiritkin_master.png`
  `overlays_effects/connect_four_drop_trail_overlay.png`
- Runtime fallback remains active:
  CSS frame, grid, and token renderer

## Battleship
- Live placeholder source:
  `boards/battleship_grid_premium_placeholder.svg`
  `room_backdrops/battleship_room_premium_placeholder.svg`
- Premium art still needed:
  `pieces_tokens/battleship_shipset_master.svg`
  `pieces_tokens/battleship_hit_marker_master.svg`
  `pieces_tokens/battleship_miss_marker_master.svg`
  `overlays_effects/battleship_sonar_overlay.png`
- Runtime fallback remains active:
  CSS grid, markers, and existing board states

## Spirit Cards
- Live placeholder source:
  `boards/spirit_cards_table_premium_placeholder.svg`
  `cards/spirit_cards_back_placeholder.svg`
  `cards/spirit_cards_frame_placeholder.svg`
  `cards/spirit_cards_founder_set_placeholder.svg`
  `room_backdrops/spirit_cards_room_premium_placeholder.svg`
- Premium art still needed:
  `overlays_effects/spirit_cards_aura_overlay.png`
- Runtime fallback remains active:
  CSS card/table renderer and current card-state logic

## Echo Trials
- Live placeholder source:
  `boards/echo_trials_panel_premium_placeholder.svg`
  `room_backdrops/echo_trials_room_premium_placeholder.svg`
- Premium art still needed:
  `pieces_tokens/echo_trials_glyph_set_master.svg`
  `cards/echo_trials_prompt_cards_master.png`
  `overlays_effects/echo_trials_resonance_overlay.png`
- Runtime fallback remains active:
  current HTML/CSS prompt and panel renderer

## Go
- Live placeholder source:
  `boards/go_board_premium_placeholder.svg`
  `room_backdrops/go_room_premium_placeholder.svg`
- Premium art still needed:
  `pieces_tokens/go_black_stone_master.png`
  `pieces_tokens/go_white_stone_master.png`
  `overlays_effects/go_hoshi_overlay.svg`
- Runtime fallback remains active:
  CSS board intersections and stone rendering

## Grand Stage
- Live placeholder source:
  `boards/grand_stage_platform_premium_placeholder.svg`
  `room_backdrops/grand_stage_room_premium_placeholder.svg`
- Premium art still needed:
  `overlays_effects/grand_stage_spotlight_overlay.png`
  `overlays_effects/grand_stage_frame_overlay.png`
- Runtime fallback remains active:
  fullscreen shell, platform renderer, and existing board logic

Current rollout summary:

- all 9 game packages now have manifest-driven named board and room source files
- Spirit Cards also has manifest-driven named card placeholder files
- final premium piece/token/overlay sets still need to be authored and dropped into these exact source slots
- placeholder files are permanent source-of-truth entries, not final premium art
