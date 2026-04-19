# Manus Archive Intake And Visual Enforcement Report

## 1. Manus archive intake

Archive audited:

- `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/manus_images_20260419/images/images`

Result:

- The archive pack was already substantially promoted earlier.
- Every runtime-usable file in that archive that matters to current live flows was already present in `Spiritverse_MASTER_ASSETS/ACTIVE`.
- No new net asset-file promotions were required from this archive in this pass.

Classification summary:

- `DIRECT_RUNTIME`: isolated chess pieces, isolated checkers pieces, chess/checkers overlays, Lyra portrait, welcome images
- `PRIMARY_SHELL`: `spiritcore-media-hero.png`, `spiritcore-spiritkins-portraits.png`, grouped chess/checkers premium sheets, go stones premium sheet
- `SUPPORT_ONLY`: grouped family sheets and composite founder sheets that are stronger as shell/chrome than as direct per-piece runtime replacements
- `ARCHIVE_ONLY`: none newly required for runtime in this pass

Manifest impact:

- `ACTIVE/manifest/asset_index.json` already contained the relevant archive-derived assets, including:
  - `Elaria.png`
  - `thalassar.png`
  - `Elaria Left Thalassar right.png`
  - `spiritcore-media-hero.png`
  - `spiritcore-spiritkins-portraits.png`

## 2. Elaria restoration

Restored runtime behavior:

- Elaria now has dedicated composite runtime media mapping in the frontend media shell layer.
- Elaria focus/profile surfaces now use `ACTIVE/concepts/Elaria.png`.
- Elaria card shell uses `ACTIVE/concepts/Elaria Left Thalassar right.png`.
- Elaria fallback portrait resolution no longer points at a missing `/portraits/elaria_portrait.png` path.

## 3. Thalassar restoration

Restored runtime behavior:

- Thalassar now has dedicated composite runtime media mapping in the frontend media shell layer.
- Thalassar focus/profile surfaces now use `ACTIVE/concepts/thalassar.png`.
- Thalassar card shell uses `ACTIVE/concepts/Elaria Left Thalassar right.png`.
- Thalassar fallback portrait resolution no longer points at a missing `/portraits/thalassar_portrait.png` path.

## 4. Per-game board/theme mapping enforced

Runtime board/theme shell mappings now enforced more visibly through the existing manifest plus stronger shell visibility:

- Chess:
  - board: `ACTIVE/boards/chess_board_lyra_base.png`
  - room: `ACTIVE/rooms/room_chess_lyra_celestial_scene.png`
- Checkers:
  - board: `ACTIVE/boards/checkers_board_dragonforge_base.png`
  - room: `ACTIVE/rooms/room_checkers_dragonforge_scene.png`
- Connect Four:
  - board: `ACTIVE/boards/connect4_board_waterfall_base.png`
  - room: `ACTIVE/rooms/room_connect4_waterfall_scene.png`
- Battleship:
  - board shell: `ACTIVE/concepts/spiritverse_battleship_forge_theme.png`
  - room: `ACTIVE/rooms/room_battleship_forge_scene.png`
- Tic Tac Toe:
  - board shell: `ACTIVE/concepts/spiritverse_tictactoe_forest_theme.png`
  - room: `ACTIVE/rooms/room_tictactoe_forest_scene.png`
- Go preview:
  - board: `ACTIVE/boards/go_board_aquatic_base.png`
  - room: `ACTIVE/rooms/room_go_aquatic_scene.png`

Enforcement change:

- The live board shell and fullscreen stage board art layers now render with materially stronger opacity, so the themed board/shell is visible as the primary experience instead of reading like a generic board floating on top of a faint backdrop.

## 5. Generic fallbacks demoted from primary use

Changed fallback behavior:

- Founder media shell fallback no longer defaults to nonexistent generic portrait paths for Elaria and Thalassar.
- Generic/basic board presentation is no longer visually dominant where stronger ACTIVE board/theme art already exists.

Fallbacks still preserved:

- Generic/default assets remain in the repo as emergency fallback only.
- No fallback asset files were deleted in this pass.

## 6. Speech duplication root cause and fix

Root cause:

- Duplicate speech requests could enter the lifecycle through overlapping frontend call paths within a short window.
- The most visible cases were immediate-repeat greeting/reply paths and replay/autoplay adjacency.
- The runtime had cancellation, but it did not have a short-window dedupe guard at the speech request boundary.

Fix:

- Added a frontend speech fingerprint dedupe guard at the `speakText()` boundary.
- Message speech now dedupes by canonical message id unless replay is explicitly forced.
- Non-message speech moments now dedupe by normalized text+voice fingerprint in a short window.
- Forced replay still bypasses this guard.

## 7. Console/runtime issues fixed

Fixed:

- Removed missing founder fallback portrait paths for Elaria and Thalassar that could generate asset 404 noise.
- Reduced the likelihood of duplicate speech lifecycle collisions that could surface as overlapping playback/runtime churn.

## 8. What still remains missing

- No dedicated Manus archive media for Elaria or Thalassar was present in the audited archive folder.
- Their restored media now uses the strongest current ACTIVE project art, but not a fresh dedicated open/close pair.
- Some game outcome banners are still shared/generic because stronger isolated per-game replacements are not yet present for every game.
