# Approved Media Asset Registry Report

## Summary

Phase B2.9 adds a durable approved media asset registry for SpiritCore media outputs. The registry fixes the gap where reviewed and ingested Lyra clips existed on disk, but the Command Center catalog could not reliably discover them for sequence planning.

Registry path:

`Spiritverse_MASTER_ASSETS/APPROVED/_registry/approved_media_assets.registry.json`

## What Changed

- `mediaAssetIngestService.mjs` now upserts approved media asset records into the registry after a successful reviewed asset ingest.
- Registry records are de-duplicated by `entityId + packId + assetType + variant + providerJobId`.
- `/admin/media/approved-asset-registry-backfill-plan` creates read-only backfill plans from approved metadata sidecars.
- `/admin/media/approved-asset-registry-backfill-execute` writes only the approved registry and remains staging/operator controlled.
- `/admin/media/command-center-catalog` now prefers `approved_registry` records and falls back to limited metadata discovery only when no registry records exist.

## Registry Record Fields

Each record includes:

- `entityId`
- `packId`
- `assetType`
- `variant`
- `status`
- `provider`
- `providerJobId`
- `savedPath`
- `metadataPath`
- `rawArchivePath`
- `sourceAssetRef`
- `durationSec`
- `ratio`
- `generationMode`
- `reviewNotes`
- `approvedBy`
- `approvedAt`
- `registryVersion`

## Safety Guarantees

- No Runway provider calls.
- No media generation.
- No promotion.
- No manifest update.
- No ACTIVE write.
- No legacy generator usage.
- Existing approved files are preserved in place.
- Historical duplicate filenames are not renamed or moved.

## Lyra Backfill

The following historical Lyra metadata sidecars can be registered without moving files:

- `Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_lyra_motion_pack_v1_idle_01_v1_approved_20260426_2a8cb3b449.metadata.json`
- `Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_lyra_motion_pack_v1_speaking_01_v1_approved_20260426_6758f00da7.metadata.json`
- `Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_listen_01_v1_approved_20260426_e2b1f2220c.metadata.json`
- `Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_gesture_01_v1_approved_20260426_83dc83d011.metadata.json`

After backfill, the command center catalog should return:

- `approvedAssetDiscoveryMode: "approved_registry"`
- Approved assets for `idle_01`, `speaking_01`, `listen_01`, and `gesture_01`
- Ready sequence candidates for:
  - `conversation_presence_01`
  - `greeting_short_01`
  - `listening_response_01`
  - `calm_presence_loop_01`

## Why This Matters

The registry prevents approved outputs from becoming invisible to later planning steps. It gives the Command Center a stable source of truth for approved clips, which enables sequence composition and future pack completeness checks without scanning arbitrary folders or duplicating media logic in the frontend.

## Premium Readiness Impact

Premium self-generation remains disabled. The approved registry is a prerequisite for future premium workflows because it supports:

- Pack completeness checks.
- Partial pack activation rules.
- Approved asset reuse.
- Retry and failure separation.
- Sequence composition from approved clips.
- Admin review and exception workflows.

## Intentionally Not Implemented

- No ACTIVE promotion route.
- No manifest mutation.
- No automatic sequence assembly.
- No failed-job persistent registry.
- No user-facing generation.
- No production staging bypass.

## Validation

Required validation:

- `npm test` passed.
- `node scripts/endpoint-diagnostics.mjs` passed with `181` passes, `0` skips, and `0` failures.
- `node scripts/system-authority-diagnostics.mjs` passed with `19` passes and `0` failures.
