# Codex Implementation Guide

## Asset Root
Use this folder as the primary import source for premium game visuals.

## Recommended mapping
- Chess board: `boards/chess_board_base_v1.png` or `boards/chess_board_base_v2.png`
- Checkers board: `boards/checkers_board_base_v1.png` or `boards/checkers_board_base_v2.png`
- Connect Four board: `boards/connect4_board_base_v1.png` or `boards/connect4_board_base_v2.png`
- Battleship ships: `ships/battleship_ship_set_v1.png` or `ships/battleship_ship_set_v2.png`
- Go stones: `tokens/go_stones_set_v2.png` and `tokens/go_stone_layout_preview_v1.png`
- Tic Tac Toe tokens: `tokens/tictactoe_token_set_v1.png` or `tokens/tictactoe_token_set_v2.png`
- Move highlight: `fx/move_highlight_ring_blue_v1.png` or `fx/move_highlight_ring_gold_v2.png`
- Thinking banner: `ui/spiritkin_thinking_banner_v1.png` or `ui/spiritkin_thinking_banner_v2.png`
- Turn banner: `ui/your_move_banner_v1.png` or `ui/your_move_banner_v2.png`
- Outcome banners: `ui/you_won_banner_*`, `ui/you_lost_banner_*`
- Check/checkmate: `ui/check_banner_*`, `ui/checkmate_banner_*`
- Modal frame: `ui/modal_frame_premium_v1.png` or `ui/modal_frame_premium_v2.png`
- Room backdrops: use `rooms/` and `concepts/` as themed loading/splash/backplate layers

## Important implementation note
If an asset is a lineup or sheet rather than a perfect isolated sprite, use it first as:
1. premium visual reference
2. temporary HUD art
3. side panel / roster / game-start art
4. framed layered texture behind a clean logical grid

Do not sacrifice gameplay clarity to force full art replacement too early.
