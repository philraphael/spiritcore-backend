# Root Test Script Validation Report

## Scripts Added

- `check:server`: `node --check server.mjs`
- `check:app`: `node --check spiritkins-app/app.js`
- `check:games`: `node --check spiritkins-app/spiritverse-games.js`
- `diagnostics:endpoints`: `node scripts/endpoint-diagnostics.mjs`
- `test`: `npm run check:server && npm run check:app && npm run check:games && npm run diagnostics:endpoints`

## npm test Result

- Initial sandbox run reached `diagnostics:endpoints` and failed with `spawn EPERM` when the endpoint diagnostics script attempted to spawn the local server process.
- Rerun with approved escalation passed.

## Diagnostics Result

- Endpoint diagnostics passed: 31 passed, 0 skipped, 0 failed.
- Verified routes included health, app assets, Spiritkin media, conversations, session, games, interaction, and speech.

## Known Limitation

- In the Codex sandbox, `scripts/endpoint-diagnostics.mjs` can require escalation because it spawns a local server process. This is an environment permission issue, not an npm script compatibility issue.
- The `&&` test chain worked in the current Windows/npm environment.

## Lint and Build

- No root lint or build scripts were added.
- No root linter or build system is currently configured in `package.json`, so fake validation commands were intentionally avoided.
