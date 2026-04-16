# Spiritverse Game Themes Source of Truth

This directory is the permanent source-of-truth root for Spiritverse game visuals.

Structure:

- `Chess/`
- `Checkers/`
- `TicTacToe_of_Echoes/`
- `Connect_Four/`
- `Battleship/`
- `Spirit_Cards/`
- `Echo_Trials/`
- `Go/`
- `Grand_Stage/`

Each game supports the same visual slots:

- `boards/` for board or table art
- `pieces_tokens/` for pieces, stones, discs, marks, ships, and token sheets
- `cards/` for card faces, backs, frames, or prompt decks
- `room_backdrops/` for surrounding scene or premium room/backdrop art
- `overlays_effects/` for highlights, trails, glows, spotlights, and effects references

Naming convention:

- use lowercase snake_case with a `_master` suffix for source files
- examples:
  - `chess_board_master.png`
  - `connect_four_disc_user_master.png`
  - `spirit_cards_founder_set_master.png`
  - `grand_stage_room_master.png`

Rules:

- this folder is the source of truth for named visual assets
- do not replace this structure with one-off generated paths in app code
- manifest references live in `spiritkins-app/data/gameAssetManifest.js`
- runtime CSS/SVG renderers remain valid fallbacks until premium art is added here
