# Runway SpiritGate Automation Pipeline Report

## What Was Implemented

Phase A14 adds the backend/operator foundation for automated SpiritCore-controlled SpiritGate source-video enhancement. The system can now register source media references, build a SpiritGate enhancement execution plan, shape a Runway video-to-video payload, and keep the generated output lifecycle in `review_required`.

No normal-user generation surface was added.

## Source Media Intake Strategy

Source media references now support:

- `sourceAssetId`
- `targetId`
- `targetType`
- `assetKind`
- `sourceType`
- `sourceUrl`
- `storagePath`
- `providerCompatibility`
- `uploadedAt`
- `notes`
- `approvedForReference`
- `usageRestrictions`

Supported source types:

- `uploaded_video`
- `uploaded_image`
- `existing_asset`
- `external_url`

This is a reference registry, not a full upload/storage service. Existing URLs and storage paths can be accepted safely for operator-reviewed generation planning.

## Runway Model / Tool Mapping

Provider target modes are now distinct:

- `text_to_image`
- `image_to_video`
- `video_to_video`
- future `video_upscale/enhancement`

SpiritGate video enhancement maps to:

- provider: Runway
- provider mode: `video_to_video`
- endpoint: `/v1/video_to_video`
- model: `gen4_aleph`
- payload source field: `videoUri`

Fallback if video-to-video cannot be used:

- provider mode: `image_to_video`
- model: `gen4_turbo`
- source should be a reviewed frame extracted from the existing SpiritGate video

## SpiritGate Enhancement Execution Flow

Route added:

- `POST /admin/media/spiritgate-enhancement-execute`

The route accepts:

- `targetId`
- `sourceAssetRef`
- `sourceAssetType`
- `promptIntent`
- `styleProfile`
- `safetyLevel`
- `runwayTransientKey`
- `operatorApproval`

Required execution gates:

- `NODE_ENV=staging`
- `RUNWAY_STAGING_TEST_BYPASS=true`
- `operatorApproval=true`
- `targetId` is `spiritgate` or `test-spiritgate`
- `safetyLevel=internal_review`
- `sourceAssetRef` is present
- source concept must be preserved
- original replacement is not allowed
- no auto-promotion
- no manifest update
- no ACTIVE write

The route also supports request-scoped transient execution flags for the controlled staging test:

- `x-runway-transient-execute: true`
- `x-runway-transient-provider-execution: true`

These headers are honored only when the request is a valid staging SpiritGate enhancement request and a transient Runway key is provided in the body. They do not modify global `process.env`.

The route returns a media asset record in `review_required` state. Provider execution occurs only when the staging/operator gates and existing Runway execution gates pass.

## Command Center Readiness

The SpiritGate execution response includes command-center metadata:

- source asset required
- model/tool recommendation
- operator approval required
- estimated provider target
- generation status
- review status
- promotion disabled until approval

No command-center UI was added in this phase.

## Premium Member Generation Boundary

Premium member generation remains disabled.

Readiness checklist before premium user-created Spiritkin generation can be exposed:

- user creation form
- safety moderation
- style governance
- generation budget/credit limits
- starter asset pack requirements
- failed generation recovery
- review/approval mode
- storage strategy
- voice/wake/motion completeness
- user-facing status messaging

## Routes Added

- `POST /admin/media/source-reference-plan`
- `POST /admin/media/spiritgate-enhancement-execute`

## Diagnostics Results

`npm test` passed.

Endpoint diagnostics:

- pass count: 99
- skip count: 0
- fail count: 0

Schema diagnostics:

- read-only verification passed
- table checks passed
- column checks passed
- index checks remain unverified where Supabase does not expose `pg_catalog.pg_indexes`

New diagnostics verify:

- SpiritGate enhancement execution route exists
- missing `sourceAssetRef` is rejected
- missing `operatorApproval` cannot execute provider
- production staging bypass is denied
- valid staging request builds a `video_to_video` `gen4_aleph` payload
- no auto-promotion occurs
- no manifest update occurs
- no ACTIVE write occurs
- generated output lifecycle is `review_required`
- premium member generation remains disabled
- command-center metadata exists

## Next Exact Staging Test

After deploying this commit to staging only, set or confirm:

- `NODE_ENV=staging`
- `RUNWAY_STAGING_TEST_BYPASS=true`
- `RUNWAY_DRY_RUN_EXECUTE=true`
- `RUNWAY_ALLOW_PROVIDER_EXECUTION=true`
- a valid Runway key through staging env or `runwayTransientKey`

Then run one operator-approved SpiritGate enhancement request against staging with the existing Pika Labs SpiritGate video URL or accepted Runway/data URI as `sourceAssetRef`.

Do not promote the result. Use `/admin/runway/status-check` to inspect the provider task, then create a media review plan and keep the output in `review_required`.

## Confirmation

No Runway generation occurred during A14 implementation or tests.

No provider execution occurred during diagnostics.

No promotion occurred.

No manifest update occurred.

No `ACTIVE` write occurred.

The existing SpiritGate video was not overwritten or replaced.
