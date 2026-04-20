## Server route added

- Added a canonical ACTIVE asset route in [server.mjs](C:/spiritcore-backend/server.mjs):
  - `/app/assets/*` -> `Spiritverse_MASTER_ASSETS/ACTIVE`
- Kept older compatibility routes intact so existing deployments do not break while the frontend moves to the canonical path.

## Paths standardized

- Standardized runtime asset URLs to:
  - `/app/assets/concepts/...`
  - `/app/assets/rooms/...`
  - `/app/assets/boards/...`
  - `/app/assets/pieces/...`
  - `/app/assets/tokens/...`
- Updated these runtime path builders and references:
  - [spiritkins-app/app.js](C:/spiritcore-backend/spiritkins-app/app.js)
  - [spiritkins-app/data/gameAssetManifest.js](C:/spiritcore-backend/spiritkins-app/data/gameAssetManifest.js)
  - [spiritkins-app/spiritverse-games.js](C:/spiritcore-backend/spiritkins-app/spiritverse-games.js)
  - [spiritkins-app/spiritverse-games.css](C:/spiritcore-backend/spiritkins-app/spiritverse-games.css)
  - [spiritkins-app/styles.css](C:/spiritcore-backend/spiritkins-app/styles.css)

## Undefined sources fixed

- Fixed the known `undefined` source path root cause:
  - `WORLD_ART.baseTheme` was being referenced at runtime, but `WORLD_ART` only defined `background`.
- Added `baseTheme` as an alias to the same canonical file in [spiritkins-app/app-constants.js](C:/spiritcore-backend/spiritkins-app/app-constants.js).
- Hardened `worldArtUrl(filename)` and `activeAssetUrl(category, filename)` in [spiritkins-app/app.js](C:/spiritcore-backend/spiritkins-app/app.js) so falsy inputs return an empty string instead of building `/something/undefined`.
- Hardened `worldArtImage(...)` so it returns no image markup if the source cannot be resolved.

## Exact files that were failing

- `Elaria.png`
- `Elaria Left Thalassar right.png`
- `thalassar.png`
- `Spiritverse background base theme.png`

These files were verified on disk under `Spiritverse_MASTER_ASSETS/ACTIVE`:
- `ACTIVE/concepts/Elaria.png`
- `ACTIVE/concepts/Elaria Left Thalassar right.png`
- `ACTIVE/concepts/thalassar.png`
- `ACTIVE/rooms/Spiritverse background base theme.png`

## Verification results

- `node --check` passed for:
  - `server.mjs`
  - `spiritkins-app/app.js`
  - `spiritkins-app/spiritverse-games.js`
  - `spiritkins-app/data/gameAssetManifest.js`
  - `spiritkins-app/app-constants.js`
- Confirmed the canonical asset root constants now point to `/app/assets`.
- Confirmed the failing filenames exist with exact casing and spacing on disk.
- Confirmed the direct runtime hardcoded image references now use `/app/assets/...`.
