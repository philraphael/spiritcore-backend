# Media Persistent Storage Contract Report

## Summary

Phase B2.10 adds a persistent media storage root contract and storage precheck route before more Runway generation. This phase was triggered because the B2.9 Lyra approved asset registry backfill could not read previously ingested metadata on Railway:

`ENOENT under /app/Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/...`

That failure strongly indicates the prior approved files were written to runtime container storage that did not persist across deploys.

## Storage Root Contract

New environment variable:

`SPIRITCORE_MEDIA_STORAGE_ROOT`

Default local/dev root:

`Spiritverse_MASTER_ASSETS`

Recommended Railway root:

`/app/Spiritverse_MASTER_ASSETS`

Alternative Railway root:

`/app/data/Spiritverse_MASTER_ASSETS`

The selected path must match the Railway volume mount and must be used consistently by source still ingest, approved asset ingest, approved registry backfill, and future sequence composition.

## New Helper

`src/services/mediaStorageRoot.mjs`

Functions:

- `getMediaStorageRoot()`
- `resolveMediaPath(relativePath)`
- `getStoragePrecheck()`
- `ensureMediaDirectories()`

Logical paths such as:

`Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/example.mp4`

are now resolved under the configured storage root while preserving logical paths in API responses and metadata.

## New Route

`POST /admin/media/storage-precheck`

Default behavior is read-only.

It reports:

- current working directory
- resolved storage root
- whether `SPIRITCORE_MEDIA_STORAGE_ROOT` is set
- whether storage root exists
- whether `APPROVED`, `REVIEW`, `ARCHIVE`, `ACTIVE`, and `APPROVED/_registry` exist
- Railway volume mount/name visibility
- whether the root appears likely persistent
- warnings if storage looks ephemeral

Optional `testWrite=true` writes a tiny file under:

`Spiritverse_MASTER_ASSETS/REVIEW/_precheck/`

It never writes ACTIVE, updates manifests, calls providers, generates media, or promotes assets.

## Service Updates

Updated services:

- `mediaAssetIngestService.mjs`
- `sourceStillIngestService.mjs`
- approved asset registry/backfill logic
- command center catalog storage readiness

Ingest responses now include:

- `storageRoot`
- `resolvedPath`
- `resolvedMetadataPath`

Backfill now reports clearer missing-file/path errors:

- `file_missing`
- `path_outside_storage_root`
- `metadata_invalid_json`

## Command Center Catalog

`POST /admin/media/command-center-catalog` now includes:

`storageReadiness`

with:

- `storageRoot`
- `storageRootExists`
- `railwayVolumeDetected`
- `likelyPersistent`
- `warnings`

If storage is likely ephemeral, it reports:

`Media assets may be lost on redeploy until a Railway Volume or durable object storage is configured.`

## Railway Setup

Recommended staging setup:

1. Add a Railway Volume to the staging service.
2. Mount it at one stable path:
   - `/app/Spiritverse_MASTER_ASSETS`, or
   - `/app/data/Spiritverse_MASTER_ASSETS`
3. Set:
   - `SPIRITCORE_MEDIA_STORAGE_ROOT=/app/Spiritverse_MASTER_ASSETS`
4. Keep existing staging test env only on staging:
   - `MEDIA_STAGING_TEST_BYPASS=true`
5. Run:
   - `POST /admin/media/storage-precheck` with `testWrite=false`
6. If the root and directories look correct, run one staging-only write precheck:
   - `testWrite=true`
7. Re-run approved asset/source still ingest only after persistence is confirmed.

## Still Disabled

- Runway generation
- Provider calls
- Promotion
- ACTIVE writes
- Manifest updates
- Premium self-generation
- Automatic file migration or recovery

## Validation

- `npm test` passed.
- `node scripts/endpoint-diagnostics.mjs` passed with `186` passes, `0` skips, and `0` failures.
- `node scripts/system-authority-diagnostics.mjs` passed with `19` passes and `0` failures.

## Next Steps

1. Configure the Railway staging volume and `SPIRITCORE_MEDIA_STORAGE_ROOT`.
2. Run storage precheck on staging.
3. Re-ingest or backfill Lyra approved clips only after persistence is confirmed.
4. Continue media generation only after approved assets survive redeploy.

