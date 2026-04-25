# Runway Provider Contract And Dry Run Report

Date: 2026-04-25

Scope: Phase A7 Runway preparation only. No real Runway assets were generated, no frontend user-facing generation controls were added, no database schema was modified, and existing media fallback behavior was left intact.

## Provider Contract

Added `src/services/runwayProvider.mjs` as a no-cost provider contract layer.

Exports:

- `buildRunwayPrompt(input)`
- `validateRunwayJobRequest(input)`
- `createDryRunJob(input)`
- `normalizeRunwayAssetKind(kind)`
- `RUNWAY_SUPPORTED_ASSET_KINDS`
- `RUNWAY_JOB_LIFECYCLE_STATES`

Default behavior:

- validates and normalizes a candidate Runway job
- builds a prompt package and negative prompt
- proposes storage and future public paths
- returns lifecycle state `dry_run`
- returns `externalApiCall: false`
- does not call Runway
- does not write generated assets

`RUNWAY_DRY_RUN_EXECUTE=true` is recorded as `dryRunExecuteRequested`, but A7 still does not implement paid external execution. Real execution remains deferred to a later operator-only phase.

## Supported Asset Kinds

- `portrait`
- `hero`
- `idle_video`
- `speaking_video`
- `calm_video`
- `trailer`
- `realm_background`
- `game_board_theme`
- `game_piece_set`

The provider contract also normalizes common aliases such as `heroImage`, `trailerVideo`, `idle`, `speaking`, `calm`, `realmBackground`, and game board/piece variants.

## Lifecycle States

Defined states:

- `draft`
- `validated`
- `dry_run`
- `queued`
- `generating`
- `review_required`
- `approved`
- `promoted`
- `rejected`
- `failed`

A7 uses only `dry_run`. Later phases should use `queued`, `generating`, and `review_required` only behind admin/operator execution.

## Admin Route Behavior

Added admin-only dry-run routes:

- `POST /admin/runway/dry-run`
- `POST /v1/admin/runway/dry-run`

Both routes use the existing `requireAdminAccess` guard.

Validated fields:

- `spiritkinId` or `targetId` for Spiritkin media
- `realmId` or `targetId` for realm backgrounds
- `gameType` or `targetId` for game assets
- `assetKind`
- `promptIntent`
- `styleProfile`
- `safetyLevel`

Response includes:

- normalized job request
- generated prompt package
- proposed output paths
- lifecycle state `dry_run`
- supported asset kinds
- lifecycle states
- estimated risk notes
- `externalApiCall: false`

Invalid requests return structured validation errors. Unauthenticated requests are blocked by admin auth.

## Storage / Naming Contract

Proposed active storage paths:

```text
Spiritverse_MASTER_ASSETS/ACTIVE/spiritkins/{spiritkinId}/{assetKind}/{versionTag}/artifact.{ext}
Spiritverse_MASTER_ASSETS/ACTIVE/spiritkins/{spiritkinId}/{assetKind}/{versionTag}/metadata.json

Spiritverse_MASTER_ASSETS/ACTIVE/realms/{realmId}/{assetKind}/{versionTag}/artifact.{ext}
Spiritverse_MASTER_ASSETS/ACTIVE/realms/{realmId}/{assetKind}/{versionTag}/metadata.json

Spiritverse_MASTER_ASSETS/ACTIVE/games/{gameType}/{themeId}/{assetKind}/{versionTag}/artifact.{ext}
Spiritverse_MASTER_ASSETS/ACTIVE/games/{gameType}/{themeId}/{assetKind}/{versionTag}/metadata.json
```

Proposed future public served paths:

```text
/app/assets/generated/spiritkins/{spiritkinId}/{assetKind}/{versionTag}/artifact.{ext}
/app/assets/generated/realms/{realmId}/{assetKind}/{versionTag}/artifact.{ext}
/app/assets/generated/games/{gameType}/{themeId}/{assetKind}/{versionTag}/artifact.{ext}
```

These public generated paths are a contract proposal in A7. Promotion and serving of generated artifacts should be implemented only after review gating and asset existence diagnostics are added.

## Current Media Manifest Review

- `spiritkins-app/data/spiritkinMediaManifest.js` defines slot availability for portrait, hero image, trailer video, idle video, speaking video, calm video, and fallback image.
- `spiritkins-app/data/spiritkinVideoManifest.js` currently suppresses known-missing idle/speaking/emotional video candidates by returning empty arrays.
- `server.mjs` serves active assets through `/app/assets/*`, Spiritkin video files through `/app/spiritkin-videos/*`, legacy trailers through `/videos/:filename`, and runtime generated assets through `/generated-spiritkins/*`.

A7 does not alter any of that behavior.

## Environment Variables Needed Later

Already present in config:

- `RUNWAY_API_KEY`
- `RUNWAY_API_URL`
- `RUNWAY_API_VERSION`
- `RUNWAY_MODEL`
- `RUNWAY_GENERATE_PATH`
- `RUNWAY_EXTEND_PATH`
- `RUNWAY_STATUS_PATH`
- `RUNWAY_POLL_INTERVAL_MS`
- `RUNWAY_POLL_TIMEOUT_MS`
- `RUNWAY_TIMEOUT_MS`

Dry-run control:

- `RUNWAY_DRY_RUN_EXECUTE`

Required operational guards before paid execution:

- `ADMIN_AUTH_MODE=enforce`
- `ADMIN_API_KEY`
- explicit `CORS_ORIGIN`
- provider-specific cost/rate caps
- durable generated asset storage configuration
- generated asset public base URL or serving strategy

## Safety Checks

A7 dry-run validation checks:

- target identity is present for the selected asset family
- asset kind is supported
- prompt intent is present
- style profile is present
- safety level is one of `standard`, `strict`, or `internal_review`
- video duration is bounded to 4-30 seconds
- source asset list is bounded

Risk notes call out:

- no external API call was made
- outputs must require review before promotion
- Spiritkin identity risk is higher without source assets
- video jobs need cost caps and retry limits
- speaking videos should remain deferred until sync policy exists

## Intentionally Not Implemented Yet

- real Runway API calls
- paid generation
- public user-triggered generation
- frontend buttons or user-facing controls
- database schema changes
- automatic manifest promotion
- generated asset serving under `/app/assets/generated/*`
- durable object storage upload
- review queue UI changes
- speaking video synchronization

## Diagnostics Result

Endpoint diagnostics now verifies:

- unauthenticated `POST /admin/runway/dry-run` is blocked
- authenticated malformed dry-run request is rejected
- authenticated valid dry-run request returns a no-cost dry-run response with `externalApiCall: false`

Latest validation result:

- Initial sandbox `npm test` reached endpoint diagnostics and failed with known `spawn EPERM`.
- Elevated `npm test` passed.
- Endpoint diagnostics: 37 passed, 0 skipped, 0 failed.
- Schema diagnostics: passed.
- No Runway external API call was made.

## Next Phase Recommendations

Recommended next phase: **A8 - Runway Admin Execution Spike Behind Dry-Run Flag**.

Acceptance criteria:

- keep route admin-only
- require `RUNWAY_DRY_RUN_EXECUTE=true` for any provider submission
- submit one non-production test request only after confirming real Runway API payload shape
- persist provider task ID and sanitized status
- do not attach output to a live Spiritkin media slot
- keep `npm test` green
