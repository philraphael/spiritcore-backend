## SpiritGate / Entry

| Surface | Previous primary visual | New primary visual | Asset path | Mode |
| --- | --- | --- | --- | --- |
| Gate video poster | Legacy world-art poster fallback | `welcome_close.png` poster while the gate video loads | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/welcome_close.png` | direct runtime |
| Crown Gate entry hero | Text-first entry with older world-art support | welcome-close hero image beside entry copy | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/welcome_close.png` | direct runtime |
| Arrival hero | older generic/world-art style support | welcome-open hero image | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/welcome_open.png` | direct runtime |
| SpiritCore welcome | older world-art support image | SpiritCore hero artwork | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/spiritcore-media-hero.png` | direct runtime |

## Founder Selection / Spiritkin Preview

| Surface | Previous primary visual | New primary visual | Asset path | Mode |
| --- | --- | --- | --- | --- |
| Founder ensemble panel | older ensemble world-art image | SpiritCore composite founders panel | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/spiritcore-spiritkins-portraits.png` | direct runtime |
| Lyra portrait card / preview | older portrait fallback | Manus Lyra portrait / open-close media set | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/lyra_portrait.png` `Spiritverse_MASTER_ASSETS/ACTIVE/ui/lyra_open.png` `Spiritverse_MASTER_ASSETS/ACTIVE/ui/lyra_close.png` | direct runtime |
| Raien preview media | older portrait fallback | Manus open-close media set | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/raien_open.png` `Spiritverse_MASTER_ASSETS/ACTIVE/ui/raien_close.png` | direct runtime |
| Kairo preview media | older portrait fallback | Manus open-close media set | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/kairo_open.png` `Spiritverse_MASTER_ASSETS/ACTIVE/ui/kairo_close.png` | direct runtime |

## Bonded Home / Conversation Media

| Surface | Previous primary visual | New primary visual | Asset path | Mode |
| --- | --- | --- | --- | --- |
| Portrait focus / hero media for supported Spiritkins | fallback portrait logic | open-image priority for focus/hero states, portrait/close priority for cards | ACTIVE Spiritkin UI set above | direct runtime |
| SpiritCore media panel | older world-art fallback | SpiritCore hero artwork | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/spiritcore-media-hero.png` | direct runtime |

## Games

| Game / Surface | Previous primary visual | New primary visual | Asset path | Mode |
| --- | --- | --- | --- | --- |
| Chess board pieces | inline SVG set as primary | isolated Manus chess piece PNGs | `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/chess-piece-*.png` | direct runtime |
| Chess move feedback | CSS-only rings/dots | Manus selected / valid / capture overlays | `Spiritverse_MASTER_ASSETS/ACTIVE/fx/chess-overlay-selected.png` `Spiritverse_MASTER_ASSETS/ACTIVE/fx/chess-overlay-valid-move.png` `Spiritverse_MASTER_ASSETS/ACTIVE/fx/chess-overlay-capture.png` | direct runtime |
| Chess shell/support | older premium shell sheet | retained Manus lineup sheet as board shell accent | `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/spiritverse-chess-pieces-premium.png` | shell/support |
| Checkers pieces | older generic/premium fallback pieces | isolated Manus white/black and king PNGs | `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/checkers-piece-white.png` `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/checkers-piece-black.png` `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/checkers-piece-white-king.png` `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/checkers-piece-black-king.png` | direct runtime |
| Checkers selection | CSS-only highlight | Manus selection overlay | `Spiritverse_MASTER_ASSETS/ACTIVE/fx/checkers-overlay-selected.png` | direct runtime |
| Checkers shell/support | older support art | retained Manus checkers lineup sheet | `Spiritverse_MASTER_ASSETS/ACTIVE/pieces/spiritverse-checkers-pieces-premium.png` | shell/support |
| Tic Tac Toe board shell | lighter generic board feel | forest concept art remains the primary visible shell | `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/spiritverse_tictactoe_forest_theme.png` | shell/support |
| Connect Four board shell | base board only | waterfall board plus room shell remains primary visible layer | `Spiritverse_MASTER_ASSETS/ACTIVE/boards/connect4_board_waterfall_base.png` `Spiritverse_MASTER_ASSETS/ACTIVE/rooms/room_connect4_waterfall_scene.png` | direct runtime + shell/support |
| Battleship board shell | generic placeholder shell | forge concept art promoted to primary visible shell | `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/spiritverse_battleship_forge_theme.png` | shell/support |
| Go preview shell | generic stones/readability-only look | Manus premium stones sheet as support art over ACTIVE board/room | `Spiritverse_MASTER_ASSETS/ACTIVE/tokens/spiritverse-go-stones-premium.png` | shell/support |

## Welcome / Open-Close Surfaces

| Surface | Previous primary visual | New primary visual | Asset path | Mode |
| --- | --- | --- | --- | --- |
| Welcome closed state | older world-art fallback | `welcome_close.png` | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/welcome_close.png` | direct runtime |
| Welcome open state | older world-art fallback | `welcome_open.png` | `Spiritverse_MASTER_ASSETS/ACTIVE/ui/welcome_open.png` | direct runtime |

## Remaining Generic Surfaces

| Surface | Why it remains |
| --- | --- |
| `Spirit Cards` board / frame assets | no better isolated runtime pack exists yet; current ACTIVE files are still explicit placeholders and replacing them now would reduce clarity |
| `Echo Trials` shell assets | no better complete runtime panel set exists yet; current ACTIVE shell remains honest placeholder support |
| some win/loss banners for non-chess games | existing `generic_you_won` / `generic_you_lost` assets are already themed ACTIVE assets, and there is not yet stronger per-game isolated coverage for every title |
| Grand Stage platform shell | no stronger dedicated platform asset exists yet beyond the current ACTIVE placeholder shell |

## Enforcement Notes

1. Generic/default visuals were removed as the primary user-facing layer wherever a stronger Manus or ACTIVE asset already existed.
2. Grouped/family assets were only used as shell/support where direct replacement would have reduced gameplay clarity.
3. The main remaining generic surfaces are documented above because there is not yet a cleaner runtime-safe replacement in the repository.
