## PWA Foundation Verification

Branch: `feature/bond-manager-mode-v2`

### Status

- `spiritkins-app/manifest.json` exists and is wired to `/app/manifest.json`
- `spiritkins-app/sw.js` exists and is wired to `/app/sw.js`
- `spiritkins-app/index.html` includes:
  - manifest link
  - safe service worker registration
- `spiritkins-app/app.js` includes:
  - `installPwaExperience()`
  - `beforeinstallprompt` capture
  - Settings install action and button state

### Safe Asset Finalization

The requested final PWA asset URLs now resolve through the existing `/app/assets/*` route:

- `/app/assets/pwa/icon-192x192.png`
- `/app/assets/pwa/icon-512x512.png`
- `/app/assets/pwa/splash-540x720.png`
- `/app/assets/pwa/splash-1280x720.png`

Served source files live under:

- `Spiritverse_MASTER_ASSETS/ACTIVE/pwa`

This keeps the PWA assets inside the existing active asset-serving root instead of adding a new static pipeline.

### Route Verification

Local `/app` route probe against `server.mjs` on port `3115` returned:

- `200 /app/manifest.json`
- `200 /app/sw.js`
- `200 /app/assets/pwa/icon-192x192.png`
- `200 /app/assets/pwa/icon-512x512.png`
- `200 /app/assets/pwa/splash-540x720.png`
- `200 /app/assets/pwa/splash-1280x720.png`

### Code Changes

- `server.mjs`
  - allowed `manifest.json` and `sw.js` through the existing `/app/:asset` route
  - added correct manifest MIME handling
- `spiritkins-app/manifest.json`
  - updated icons to final `/app/assets/pwa/*` paths
  - added splash screenshot entries
- `spiritkins-app/sw.js`
  - added manifest, service worker, and final PWA assets to the shell cache list

### Diagnostics

- `node --check spiritkins-app/app.js` passed
- `node scripts/endpoint-diagnostics.mjs` passed `31/31`

### Remaining Notes

- Browser-side install prompt behavior still requires manual browser confirmation because shell verification cannot truthfully confirm `beforeinstallprompt` availability.
- Existing non-blocking warnings remain unchanged:
  - `MODULE_TYPELESS_PACKAGE_JSON`
  - no image generation provider configured
  - no video generation provider configured
