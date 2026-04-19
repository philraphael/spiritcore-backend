# SpiritVerse Asset System

## Structure

The asset pipeline is organized into three top-level areas:

- `Spiritverse_MASTER_ASSETS/ACTIVE`
- `Spiritverse_MASTER_ASSETS/INCOMING`
- `Spiritverse_MASTER_ASSETS/ARCHIVE`

`ACTIVE` contains the curated runtime-facing assets that the app is allowed to reference directly.

### ACTIVE folders

- `boards`
- `pieces`
- `tokens`
- `ships`
- `ui`
- `fx`
- `rooms`
- `concepts`
- `manifest`
- `docs`

## Reference Rules

The app should reference runtime assets from `ACTIVE` only.

- Filesystem root: `Spiritverse_MASTER_ASSETS/ACTIVE`
- Public runtime route: `/app/active-assets/<category>/<filename>`
- World art lookup: served from `ACTIVE/rooms` first, then `ACTIVE/concepts`

Examples:

- `/app/active-assets/boards/chess_board_lyra_base.png`
- `/app/active-assets/ui/modal_frame_premium.png`
- `/world-art/Spiritverse%20background%20base%20theme.png`

## Archive Rules

`ARCHIVE` keeps original source packs intact.

- Do not edit archived packs in place.
- Do not point runtime code at `ARCHIVE`.
- Archived folders are the provenance record for all currently active assets.

## Incoming Rules

Place all new asset drops in `INCOMING` first.

Required process for new drops:

1. Put the raw pack in `INCOMING/<pack-name>`.
2. Review filenames, categories, and resolutions.
3. Promote only the chosen runtime assets into `ACTIVE/<category>`.
4. Update `ACTIVE/manifest/asset_index.json`.
5. If runtime references change, update the frontend manifest or server routes accordingly.
6. Move the original pack into `ARCHIVE` once the promotion pass is complete.

## Organization Rules

- `ACTIVE` should contain only categorized, runtime-usable assets.
- Prefer the highest-resolution canonical asset when two files are the same asset with different versions.
- Keep scene references and exploratory art in `concepts`.
- Keep playable board surfaces in `boards`.
- Keep environmental or backdrop imagery in `rooms`.
- Keep banners, frames, and HUD overlays in `ui`.
- Keep effects-only layers in `fx`.
- Keep source manifests and generated indexes in `manifest`.
- Keep operational documentation in `docs`.

## Notes

- Legacy packs were preserved under `ARCHIVE` instead of deleted.
- Compatibility server routes may still exist temporarily, but new frontend work should target `/app/active-assets/*`.
