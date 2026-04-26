# SpiritCore Media Production System Report

## Architecture Overview

Phase A11 adds a controlled SpiritCore Media Production System foundation. It is a planning and governance layer for generated and managed media assets, not a generation executor.

The new foundation lives in `src/services/spiritCoreMediaProduction.mjs` and is exposed through admin/operator routes in `src/routes/admin.mjs`. It creates reusable domain primitives for asset records, requirement profiles, generation templates, continuity references, review plans, promotion plans, SpiritGate enhancement planning, and future assistant capability packs.

No Runway generation is executed by this phase. No assets are promoted. No manifests are updated. No files are written to `ACTIVE`.

## Files Changed

- `src/services/spiritCoreMediaProduction.mjs`
- `src/routes/admin.mjs`
- `scripts/endpoint-diagnostics.mjs`
- `SPIRITCORE_MEDIA_PRODUCTION_SYSTEM_REPORT.md`

## Domain Model

The media domain model defines generated and managed asset records with:

- `assetId`
- `spiritkinId`
- `targetId`
- `targetType`
- `assetKind`
- `mediaType`
- `lifecycleState`
- `reviewStatus`
- `promotionStatus`
- `activeStatus`
- `provider`
- `providerJobId`
- `sourceAssetRefs`
- `promptIntent`
- `styleProfile`
- `safetyLevel`
- `outputUrls`
- `publicPath`
- `activePath`
- `reviewPath`
- `metadataPath`
- `createdAt`
- `updatedAt`
- `reviewedAt`
- `promotedAt`
- `rollbackFromAssetId`
- `notes`

The model also derives approved, active, public, review, metadata, and rollback paths without writing to disk.

## Asset Kinds

Supported production asset kinds:

- `portrait`
- `hero`
- `full_body`
- `icon`
- `presence_indicator`
- `realm_background`
- `room_background`
- `gateway_background`
- `spiritgate_video`
- `idle_video`
- `speaking_video`
- `listening_video`
- `greeting_video`
- `wake_visual`
- `trailer_video`
- `game_board_theme`
- `game_piece_set`

## Requirement Profiles

Requirement profiles now exist for:

- `original_spiritkin`
- `premium_spiritkin`
- `spiritgate_realm`
- `game_assets`
- `wake_presence`

The requirement checker identifies:

- missing required assets
- draft-only assets
- assets awaiting review
- incomplete premium Spiritkins
- assets ready for promotion
- currently active assets

The checker is diagnostic only and does not block current app behavior.

## Generation Templates

Prompt template support was added for:

- SpiritGate enhancement
- realm background
- bonded room background
- Spiritkin portrait upgrade
- idle loop
- speaking loop
- listening loop
- greeting loop
- wake-call visual
- trailer/intro
- presence indicator
- game board theme
- game piece set

Templates are parameterized by:

- spiritkin name
- spiritkin role
- visual identity
- lore summary
- color palette
- emotional tone
- asset kind
- style profile
- safety level
- reference assets

Template generation returns prompt text and metadata only. It does not call Runway or any provider.

## Continuity Strategy

The continuity resolver can identify:

- primary canonical reference image
- approved identity references
- approved room/environment references
- prior active motion assets
- source assets used
- rejected, archived, or failed assets that should be excluded

This gives future Runway work a consistent reference foundation for Lyra, Raien, Kairo, Solis, Neris, premium Spiritkins, and future companions.

## SpiritGate Strategy

SpiritGate is treated as a durable brand and lore asset. The current Pika Labs SpiritGate concept is considered an existing source asset, not something to overwrite.

The system supports:

- enhancement requests
- quality-upgrade requests
- versioned review paths
- promotion paths
- rollback paths
- gateway scene compatibility

SpiritGate enhancement plans explicitly set `originalReplacementAllowed: false`.

## Premium Spiritkin Strategy

Premium user-created Spiritkins have a dedicated requirement profile with stricter identity and presence coverage:

- portrait
- hero
- full body
- icon
- presence indicator
- idle video
- speaking video
- listening video
- greeting video
- wake visual

This prepares for future premium companions without changing schema or current user-facing flows.

## Review And Promotion Lifecycle

Operator-controlled lifecycle states:

- `draft`
- `generated`
- `review_required`
- `approved`
- `rejected`
- `promoted`
- `active`
- `archived`
- `failed`

Promotion planning returns paths, manifest targets, required checks, rollback paths, and `operatorApprovalRequired: true`.

No asset becomes active automatically. No manifest patch is applied automatically. No file is written to `ACTIVE`.

## Admin Routes Added

- `POST /admin/media/asset-plan`
- `POST /admin/media/requirements-check`
- `POST /admin/media/generation-template`
- `POST /admin/media/review-plan`
- `POST /admin/media/promotion-plan`
- `POST /admin/media/spiritgate-enhancement-plan`
- `GET /admin/media/catalog-summary`

All routes use the existing admin access guard and return planning/diagnostic data only.

## Wake And Living Presence Preparation

The asset model and requirement profiles now support:

- wake-call visuals
- passive presence indicators
- listening visual state
- speaking visual state
- idle visual state
- greeting visual state
- background companion presence
- mic-on/mic-off compatible visual states
- non-intrusive wake behavior

Wake behavior itself was not changed.

## Assistant Capability Roadmap

Future assistant-style capability packs are documented as separate domain packs, not embedded inside the media system:

- alarms
- reminders
- daily routines
- music/audio actions
- calendar support
- task support
- future smart home support
- family-safe companion interactions
- learning/play modes
- games and entertainment
- emotional check-ins

These should be implemented as capability services that consume SpiritCore memory, safety, session state, notifications, and media assets. The media system should provide the visual/presence substrate, not become the assistant workflow engine.

## Diagnostics

Endpoint diagnostics now verify:

- media asset kinds are valid
- requirement profiles exist
- original Spiritkins can be checked against requirements
- premium Spiritkin requirement profile exists
- template generation produces prompt text without provider calls
- review/promotion plans do not write ACTIVE assets automatically
- SpiritGate enhancement plans preserve the original source asset
- assistant capability roadmap is documented
- media catalog performs no Runway generation
- admin media routes return no-provider/no-promotion/no-manifest/no-ACTIVE-write flags

## Intentionally Not Implemented

This phase does not:

- run Runway generation
- download generated assets
- promote assets
- update active manifests
- write to `ACTIVE`
- expose generation to normal users
- change frontend behavior
- change database schema
- implement wake behavior changes
- implement assistant capability packs
- replace the existing SpiritGate source concept

## Next Recommended Phase

Recommended next phase: operator-reviewed A12 production intake.

That phase should take the completed A10 output URL, create a media asset record, run it through review planning, produce a promotion plan, and manually move it through `REVIEW` and `APPROVED` before any manifest or `ACTIVE` path update is considered.
