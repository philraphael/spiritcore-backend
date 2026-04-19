# Manus Image Pack Implementation Report

## Promoted Assets

Primary runtime promotions into `Spiritverse_MASTER_ASSETS/ACTIVE`:

- `pieces/`
  - `chess-piece-pawn-white.png`
  - `chess-piece-pawn-black.png`
  - `chess-piece-rook-white.png`
  - `chess-piece-rook-black.png`
  - `chess-piece-knight-white.png`
  - `chess-piece-knight-black.png`
  - `chess-piece-bishop-white.png`
  - `chess-piece-bishop-black.png`
  - `chess-piece-queen-white.png`
  - `chess-piece-queen-black.png`
  - `chess-piece-king-white.png`
  - `chess-piece-king-black.png`
  - `spiritverse-chess-pieces-premium.png`
  - `checkers-piece-white.png`
  - `checkers-piece-black.png`
  - `checkers-piece-white-king.png`
  - `checkers-piece-black-king.png`
  - `spiritverse-checkers-pieces-premium.png`
- `fx/`
  - `chess-overlay-selected.png`
  - `chess-overlay-valid-move.png`
  - `chess-overlay-capture.png`
  - `checkers-overlay-selected.png`
- `tokens/`
  - `spiritverse-go-stones-premium.png`
- `ui/`
  - `lyra_portrait.png`
  - `lyra_open.png`
  - `lyra_close.png`
  - `raien_open.png`
  - `raien_close.png`
  - `kairo_open.png`
  - `kairo_close.png`
  - `welcome_open.png`
  - `welcome_close.png`
  - `spiritcore-media-hero.png`
  - `spiritcore-spiritkins-portraits.png`
- `concepts/`
  - `spiritcore-architecture-layers.png`
- `docs/`
  - `spiritverse_beta_qr.png`

The original imported pack was archived to:

- `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/manus_images_20260419/images`
- `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/manus_images_20260419/images.zip`

## Primary Runtime Visuals

These became the primary runtime visuals:

- Chess:
  - isolated white/black piece PNGs for all six piece types
  - selected / valid-move / capture overlays
- Checkers:
  - isolated white/black piece PNGs
  - king PNG variants
  - selected overlay
- Spiritkin / media:
  - Lyra portrait and open/close expressions
  - Raien open/close expressions
  - Kairo open/close expressions
  - SpiritCore founder composite for founder ensemble panels
  - welcome open / close art for entry and arrival surfaces
  - SpiritCore media hero for the welcome screen

## Support / Shell Only

These remain support-layer assets rather than direct gameplay replacements:

- `pieces/spiritverse-chess-pieces-premium.png`
  - used as shell/support art in the chess asset manifest
- `pieces/spiritverse-checkers-pieces-premium.png`
  - used as shell/support art in the checkers asset manifest
- `tokens/spiritverse-go-stones-premium.png`
  - used as premium preview shell support only because Go is still intentionally constrained
- `concepts/spiritcore-architecture-layers.png`
  - promoted for reference/future system-facing surfaces, not forced into runtime UI now

## Per-Game / Per-Surface Upgrades

- Chess
  - Replaced inline SVG runtime pieces with the new isolated PNG chess pieces.
  - Added primary runtime overlays for selected squares, valid moves, and captures.
  - Kept the existing premium board / room shell treatment.
- Checkers
  - Replaced CSS-disc runtime pieces with the new isolated PNG pieces.
  - Added king-specific PNG variants.
  - Added Manus selected overlay without changing gameplay rules.
- Bonded / founder surfaces
  - Founder ensemble panel now uses the new composite founder art instead of older world-art fallback.
  - Founder portraits now use the new founder media where available.
  - Focus / hero portrait surfaces prefer the `open` founder images for Lyra, Raien, and Kairo.
  - Mini / card portraits prefer the calmer `close` variants where available.
- Entry / welcome surfaces
  - SpiritGate pre-entry card now shows `welcome_close.png`.
  - Spiritverse arrival uses `welcome_open.png`.
  - SpiritCore welcome uses `spiritcore-media-hero.png`.

## Left Intentionally Unchanged

- Connect Four
  - no new isolated pack assets strong enough to justify a runtime swap
- Battleship
  - no new isolated ships/markers in this pack
- Tic Tac Toe
  - no new isolated runtime marks in this pack
- Go
  - remained truthful as a constrained preview surface; the new stones sheet was not forced into fake completeness

## What Still Needs Future Visual Waves

- Direct isolated runtime assets for:
  - Connect Four
  - Battleship
  - Tic Tac Toe
  - a fully finished, truthful Go set if Go later becomes complete
- Additional founder portrait coverage for:
  - Elaria
  - Thalassar
- Cleaner dedicated SpiritGate / SpiritCore illustration layers if the entry system gets a later premium art pass
