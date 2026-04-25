# Generated Asset Pipeline Plan Report

Date: 2026-04-25

Scope: Phase A8 generated asset storage, review, and promotion planning. No Runway calls, no paid generation, no user-facing generation, no database schema changes, no asset writes, and no manifest updates were performed.

## Lifecycle Directories

Defined generated asset lifecycle directories:

- `INCOMING`: raw provider output or uploaded/generated candidate assets awaiting review intake.
- `REVIEW`: operator review staging area for identity, safety, quality, and slot-fit checks.
- `APPROVED`: reviewed artifacts approved for promotion but not yet live.
- `ACTIVE`: live assets served by the app after explicit operator promotion.
- `REJECTED`: assets rejected during review and retained for audit/debugging.
- `ARCHIVE`: rollback, superseded, or retired generated assets.

Current repository state already has:

- `Spiritverse_MASTER_ASSETS/ACTIVE`
- `Spiritverse_MASTER_ASSETS/ARCHIVE`
- `Spiritverse_MASTER_ASSETS/INCOMING`
- `Spiritverse_MASTER_ASSETS/Game_Themes`
- `Spiritverse_MASTER_ASSETS/Spiritkin_Videos`

`REVIEW`, `APPROVED`, and `REJECTED` are defined as the intended pipeline directories, but this phase does not create folders or write files.

## Service Added

Added `src/services/generatedAssetPipeline.mjs`.

Exports:

- `buildGeneratedAssetRecord(input)`
- `validateGeneratedAssetRecord(record)`
- `proposeReviewPath(record)`
- `proposeActivePath(record)`
- `proposePublicPath(record)`
- `createPromotionPlan(record)`
- `GENERATED_ASSET_LIFECYCLE_DIRECTORIES`

The service is deliberately pure: it returns records and plans, but performs no filesystem writes, no manifest mutation, no database updates, and no external API calls.

## Promotion Rules

A generated asset may only move toward `ACTIVE` after:

- operator approval is recorded
- source artifact existence is verified
- checksum is captured
- asset kind matches the intended manifest slot
- file extension and media type are valid
- safety and identity review passed
- no existing `ACTIVE` asset is overwritten
- metadata is preserved with provider job id and prompt context
- public path resolves after promotion
- rollback copy is available before manifest update

Every promotion plan returns `operatorApprovalRequired: true`.

## Promotion Plan Output

The admin route returns:

- `sourcePath`
- `reviewPath`
- `activePath`
- `publicPath`
- `manifestTarget`
- `requiredChecks`
- `rollbackPath`
- `operatorApprovalRequired: true`
- `noFileWrites: true`
- `noManifestUpdates: true`

This gives operators and future automation a deterministic plan without changing any live media.

## Proposed Storage Paths

Review path:

```text
Spiritverse_MASTER_ASSETS/REVIEW/generated/{family}/{target}/{assetKind}/{versionTag}/artifact.{ext}
```

Approved path:

```text
Spiritverse_MASTER_ASSETS/APPROVED/generated/{family}/{target}/{assetKind}/{versionTag}/artifact.{ext}
```

Active path:

```text
Spiritverse_MASTER_ASSETS/ACTIVE/generated/{family}/{target}/{assetKind}/{versionTag}/artifact.{ext}
```

Rollback/archive path:

```text
Spiritverse_MASTER_ASSETS/ARCHIVE/generated/{family}/{target}/{assetKind}/{versionTag}/artifact.{ext}
```

Rejected path:

```text
Spiritverse_MASTER_ASSETS/REJECTED/generated/{family}/{target}/{assetKind}/{versionTag}/artifact.{ext}
```

Future public path:

```text
/app/assets/generated/{family}/{target}/{assetKind}/{versionTag}/artifact.{ext}
```

Because `/app/assets/*` already serves from `Spiritverse_MASTER_ASSETS/ACTIVE`, a future `ACTIVE/generated/...` promotion can map cleanly to `/app/assets/generated/...`.

## Asset Families

Spiritkin assets:

```text
generated/spiritkins/{spiritkinId}/{assetKind}/{versionTag}/artifact.{ext}
```

Realm assets:

```text
generated/realms/{realmId}/{assetKind}/{versionTag}/artifact.{ext}
```

Game assets:

```text
generated/games/{gameType}/{themeId}/{assetKind}/{versionTag}/artifact.{ext}
```

## Manifest Update Model

No manifest update is implemented in A8.

Future manifest updates should be operator-controlled and should only happen after approval:

- `portrait` maps to `portrait`
- `hero` maps to `heroImage`
- `trailer` maps to `trailerVideo`
- `idle_video` maps to `idleVideo`
- `speaking_video` maps to `speakingVideo`
- `calm_video` maps to `calmVideo`

For Spiritkins, the current target manifest is:

```text
spiritkins-app/data/spiritkinMediaManifest.js
```

Generated game assets should target `spiritkins-app/data/gameAssetManifest.js` or a future generated game overlay manifest. Realm backgrounds should target a future realm/generated asset overlay. In every case, the manifest should point only at reviewed `ACTIVE` assets.

## Admin Route Behavior

Added admin-only routes:

- `POST /admin/generated-assets/promotion-plan`
- `POST /v1/admin/generated-assets/promotion-plan`

The route:

- requires the existing admin auth guard
- accepts proposed generated asset metadata
- validates target, asset kind, source path, file extension, and lifecycle state
- returns a promotion plan only
- performs no file writes
- performs no manifest updates
- performs no Runway calls

## Review Flow

Recommended operator flow:

1. Generated output lands in `INCOMING`.
2. Operator requests a promotion plan.
3. Operator verifies source file, metadata, checksum, identity, safety, quality, and target slot.
4. Asset is copied to `REVIEW`.
5. Approved asset is copied to `APPROVED`.
6. Before activation, current live asset is copied to `ARCHIVE`.
7. Approved asset is copied to `ACTIVE`.
8. Manifest is updated manually or through a future admin-only reviewed mutation.
9. Public path is verified.
10. Rollback remains available through `ARCHIVE`.

## Rollback Strategy

Before any future manifest update:

- archive the current active artifact and metadata
- store the previous manifest slot value
- verify the new public path
- keep the previous public path available until the new path is confirmed

Rollback should restore the previous manifest target and prior `ACTIVE` artifact. Rejected or failed generated assets should never be used as rollback targets.

## Intentionally Not Implemented Yet

- real Runway execution
- copying files between lifecycle directories
- creating lifecycle directories
- checksum calculation
- manifest updates
- database writes
- review UI
- generated public asset route changes
- auto-promotion
- user-triggered generation

## How This Prepares Runway Execution

A8 separates provider output from live media activation. Once Runway execution is added, generated artifacts can enter the pipeline as records with source paths and provider metadata. The system can then return deterministic review, active, public, manifest, and rollback targets before any file or manifest change occurs.

This keeps Runway integration compatible with the A1 media fallback foundation: unavailable or unapproved slots remain unavailable, and the frontend should continue falling back to still images until an operator promotes a reviewed asset.

## Diagnostics Result

Endpoint diagnostics now verifies:

- unauthenticated promotion-plan route is blocked
- authenticated malformed promotion-plan request is rejected
- authenticated valid promotion-plan request returns `operatorApprovalRequired: true`

Latest validation result:

- Initial sandbox `npm test` reached endpoint diagnostics and failed with known `spawn EPERM`.
- Elevated `npm test` passed.
- Endpoint diagnostics: 40 passed, 0 skipped, 0 failed.
- Schema diagnostics: passed.
- No Runway calls, asset writes, or manifest updates were performed.
