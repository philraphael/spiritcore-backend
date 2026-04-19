## Root Cause

Production boot failed because the frontend imports `./data/spiritkinRuntimeConfig.js` from [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js), which resolves in the browser to `/app/data/spiritkinRuntimeConfig.js`. The file exists in `spiritkins-app/data/spiritkinRuntimeConfig.js`, but the Fastify route in [server.mjs](/abs/path/C:/spiritcore-backend/server.mjs) only allowed:

1. `spiritverseCanon.js`
2. `gameThemes.js`
3. `gameAssetManifest.js`

That allowlist rejected `spiritkinRuntimeConfig.js` with a 404, causing the module graph for `app.js` to fail and the boot fallback to show `Spiritverse could not finish loading`.

## Files Changed

1. `server.mjs`
2. `BOOT_BLOCKER_HOTFIX_REPORT.md`

## Broken Path

Expected runtime URL:

`/app/data/spiritkinRuntimeConfig.js`

Broken behavior before hotfix:

`GET /app/data/spiritkinRuntimeConfig.js -> 404`

## Fix Applied

Added `spiritkinRuntimeConfig.js` to the `/app/data/:asset` allowlist in `server.mjs` so the existing frontend import path now resolves correctly without changing the module structure.

## Verification

1. `node --check server.mjs`
2. `node --check spiritkins-app/data/spiritkinRuntimeConfig.js`
3. Confirm local route logic now permits `/app/data/spiritkinRuntimeConfig.js`

