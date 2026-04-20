# FINAL MANUS ASSET REPLACEMENT REPORT

## Scope

This pass promotes the final Wave 4B Manus game imagery into the canonical ACTIVE asset pipeline and replaces earlier interim Manus runtime assets only where the final pack provides a true upgrade. The existing room-scene theme authority, Grand Stage inheritance, trailer runtime behavior, canonical `/app/assets/*` path system, and SpiritCore adaptive runtime were left intact.

## Promoted Final Assets

Promoted from `Spiritverse_MASTER_ASSETS/INCOMING/wave-4b-assets/wave-4b-assets` into `Spiritverse_MASTER_ASSETS/ACTIVE`:

- Chess pieces:
  - `pieces/chess-piece-pawn-white.png`
  - `pieces/chess-piece-pawn-black.png`
  - `pieces/chess-piece-rook-white.png`
  - `pieces/chess-piece-rook-black.png`
  - `pieces/chess-piece-knight-white.png`
  - `pieces/chess-piece-knight-black.png`
  - `pieces/chess-piece-bishop-white.png`
  - `pieces/chess-piece-bishop-black.png`
  - `pieces/chess-piece-queen-white.png`
  - `pieces/chess-piece-queen-black.png`
  - `pieces/chess-piece-king-white.png`
  - `pieces/chess-piece-king-black.png`
- Chess overlays:
  - `fx/chess-overlay-selected.png`
  - `fx/chess-overlay-valid-move.png`
  - `fx/chess-overlay-capture.png`
- Checkers pieces:
  - `pieces/checkers-piece-white.png`
  - `pieces/checkers-piece-black.png`
  - `pieces/checkers-piece-white-king.png`
  - `pieces/checkers-piece-black-king.png`
- Checkers overlay:
  - `fx/checkers-overlay-selected.png`
- Connect Four:
  - `tokens/connect4-disc-yellow.png`
  - `tokens/connect4-disc-red.png`
  - `tokens/connect4-disc-empty.png`
  - `fx/connect4-overlay-hover.png`
  - `fx/connect4-overlay-win.png`
- Battleship:
  - `ships/battleship-ship-carrier.png`
  - `ships/battleship-ship-battleship.png`
  - `ships/battleship-ship-cruiser.png`
  - `ships/battleship-marker-hit.png`
  - `ships/battleship-marker-miss.png`
- Tic Tac Toe:
  - `tokens/tictactoe-x.png`
  - `tokens/tictactoe-o.png`
- Go:
  - `tokens/go-stone-black.png`
  - `tokens/go-stone-white.png`
  - `fx/go-overlay-hint.png`
- Shared UI / FX:
  - `ui/ui-board-frame-ornate.png`
  - `fx/ui-particle-glow.png`
  - `fx/ui-victory-aura.png`
  - `fx/ui-defeat-shadow.png`

`ACTIVE/manifest/asset_index.json` was updated so these files now resolve to `wave-4b-assets` as the source of truth with `2048x2048` resolution metadata.

## Interim Assets Replaced

### Chess

- Replaced the previously promoted Manus chess piece PNGs in-place with the final Wave 4B versions under the same runtime filenames.
- Replaced the prior chess selected / valid / capture overlay PNGs in-place with the final Wave 4B versions.
- Updated direct CSS square-state rendering so the live board now uses the final overlay PNGs instead of generic border/dot/ring-only treatments.

### Checkers

- Replaced the previously promoted checkers piece PNGs in-place with the final Wave 4B versions under the same runtime filenames.
- Replaced the prior selected overlay PNG in-place with the final Wave 4B version.
- Removed the extra text crown from king rendering so the final king images remain authoritative and do not double-stack with a glyph.

### Connect Four

- Replaced direct runtime token mapping from interim:
  - `connect4_disc_blue_single_v3.png`
  - `connect4_disc_purple_single_v3.png`
  - `connect4_disc_gold_single_v3.png`
- New direct runtime tokens:
  - `connect4-disc-yellow.png`
  - `connect4-disc-red.png`
  - `connect4-disc-empty.png`
- Replaced overlay usage from interim `connect4_fx_family_v4a.png` to final:
  - `connect4-overlay-hover.png`
  - `connect4-overlay-win.png`
- Added direct empty-slot token rendering so the board no longer relies on generic empty circles as the primary visible slot treatment.

### Battleship

- Replaced direct runtime markers from interim:
  - `battleship_hit_marker_v3.png`
  - `battleship_miss_marker_v3.png`
- New direct runtime markers:
  - `battleship-marker-hit.png`
  - `battleship-marker-miss.png`
- Replaced shell/support ship references from interim family/set assets with final isolated ships where safe:
  - `battleship-ship-battleship.png`
  - `battleship-ship-carrier.png`
  - `battleship-ship-cruiser.png`

### Tic Tac Toe

- Replaced direct runtime tokens from interim:
  - `tictactoe_x_single_v3.png`
  - `tictactoe_o_single_v3.png`
- New direct runtime tokens:
  - `tictactoe-x.png`
  - `tictactoe-o.png`

### Go

- Replaced direct runtime stones from interim:
  - `go_stone_white_single_v3.png`
  - `go_stone_black_single_v3.png`
- New direct runtime stones:
  - `go-stone-white.png`
  - `go-stone-black.png`
- Replaced hover/hint overlay usage from interim `go_ring_overlay_family_v4a.png` to final `go-overlay-hint.png`.

## Preserved Current Runtime Assets

These runtime assets were intentionally preserved:

- All room-scene and board-shell assets:
  - `room_chess_lyra_celestial_scene.png`
  - `room_checkers_dragonforge_scene.png`
  - `room_connect4_waterfall_scene.png`
  - `room_battleship_forge_scene.png`
  - `room_tictactoe_forest_scene.png`
  - `room_go_aquatic_scene.png`
  - current board/concept shell assets
- Reason:
  - Wave 4B is a final isolated object pack, not a room/theme replacement pack.
  - The current stronger room/theme/Grand Stage system is already correct and should remain authoritative.

These support/shell assets were also preserved:

- `pieces/chess_white_piece_family_v4a.png`
- `pieces/chess_dark_piece_family_v4a.png`
- `pieces/checkers_piece_family_v4a.png`
- `tokens/tictactoe_token_family_v4a.png`
- `tokens/go_stone_family_v4a_left.png`
- `tokens/connect4_disc_family_v4a.png`
- `fx/battleship_marker_family_v4a.png`
- Reason:
  - They still serve as support/shell accent art where the final Wave 4B pack does not provide a direct equivalent for every shell slot.

## Remaining Gaps

- Battleship still uses final isolated ship renders only as shell/support imagery because the current live mode does not expose a full player-side ship-placement board.
- Go remains intentionally preview-constrained; the final stones and hint overlay are in place, but the game truthfulness constraint remains.
- Shared Wave 4B FX:
  - `ui-particle-glow.png`
  - `ui-victory-aura.png`
  - `ui-defeat-shadow.png`
  were promoted into ACTIVE, but not forced into every live runtime surface in this pass because that would have changed the current validated end-state chrome more aggressively than required.

## Production-Ready After This Pass

The following are now materially closer to production-ready:

- Chess:
  - final piece renders
  - final selected / valid / capture overlays
- Checkers:
  - final piece renders
  - final king renders
  - final selected overlay
- Connect Four:
  - final discs
  - final empty-slot treatment
  - final hover / win overlays
- Battleship:
  - final hit / miss markers
  - final isolated ship support renders
- Tic Tac Toe:
  - final X / O tokens
- Go:
  - final black / white stones
  - final hint overlay
- Shared game framing:
  - final `ui-board-frame-ornate.png` is now the authoritative shared board frame
