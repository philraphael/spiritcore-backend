# Motion Sequence Composition Foundation Report

## Summary

This phase adds a scalable planning layer for turning approved short Spiritkin motion clips into longer reusable premium sequences. It does not run provider generation, ingest new assets, promote to ACTIVE, or update manifests.

## Routes Added

- `POST /admin/media/motion-pack-plan`
- `POST /admin/media/sequence-compose-plan`
- `POST /admin/media/sequence-compose-execute`

All routes use the existing admin/media planning access pattern. Staging testing can use the existing `x-media-planning-test=true` bypass only when staging bypass environment flags are enabled. Production bypass denial remains intact.

## Motion Pack Batch Planning

`POST /admin/media/motion-pack-plan` accepts:

- `entityId`
- `packId`
- `requestedAssetTypes`
- optional `framingProfiles`
- optional `generationPriorities`

It returns a generation wave plan only. Each planned asset includes:

- `shotProfile`
- `poseVariant`
- `motionCompletionRule`
- `backgroundClarityMode`
- `timingIntent`
- provider settings for future Runway image-to-video use

The required motion completion rule is explicit: action begins early, readable main action occurs mid-clip, motion resolves before the clip end, and slow-motion unfinished gestures should be rejected.

## Sequence Composition Planning

`POST /admin/media/sequence-compose-plan` accepts approved local asset references and creates a review-space composition plan.

It requires every input clip to:

- have `status=approved`
- point under `Spiritverse_MASTER_ASSETS/APPROVED/`
- be an `.mp4`
- avoid `ACTIVE`

The plan returns ordered clips, total duration, transition instructions, and a review output naming/path plan under:

`Spiritverse_MASTER_ASSETS/REVIEW/{entityId}/sequence/`

No provider call, ingest, manifest update, promotion, or ACTIVE write occurs.

## Execution-Safe Composition Route

`POST /admin/media/sequence-compose-execute` validates the same approved-clip input and returns a planned-only review output candidate. It does not write files in this phase because the review-space ffmpeg writer is not implemented yet.

This keeps the route safe while preserving the future contract for local composition:

- approved clips in
- review-required composed MP4 out
- sidecar metadata later
- no ACTIVE promotion without a future explicit operator action

## Workflow

1. Plan a generation wave with `POST /admin/media/motion-pack-plan`.
2. Generate only one high-priority clip at a time through the existing controlled Runway route.
3. Review and ingest approved clips into `Spiritverse_MASTER_ASSETS/APPROVED/{entityId}/video/`.
4. Plan a longer sequence with `POST /admin/media/sequence-compose-plan`.
5. Use the planned-only execution route until the local review-space ffmpeg writer is enabled in a later phase.
6. Review the composed output before any future promotion.

## Scalability And Waste Reduction

The new structure reduces paid-generation waste by separating generation waves from sequence assembly. Short clips can be reviewed individually, rejected early, and reused in multiple sequences after approval.

The motion quality fields also make future prompts less ambiguous: each clip has a shot profile, pose variant, timing intent, background clarity target, and explicit completion rule.

## Premium User Spiritkin Support

Premium user-created Spiritkin generation remains disabled. This foundation supports future premium packs by defining reusable motion-pack waves and approved-clip composition rules without exposing generation to users.

Future premium generation should still require:

- safety moderation
- budget limits
- review/approval mode
- approved canonical stills
- starter pack completeness checks
- operator-controlled promotion

## Safety Confirmations

- No provider generation is performed.
- No ingest is performed by planning routes.
- No manifest update is performed.
- No ACTIVE write is performed.
- No auto-promotion is enabled.
- Existing approved asset ingest behavior is preserved.
