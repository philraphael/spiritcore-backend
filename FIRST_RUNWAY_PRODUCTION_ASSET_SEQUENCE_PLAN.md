# First Runway Production Asset Sequence Plan

## A12 Architecture Summary

Phase A12 adds a planning-only production sequence layer on top of the Phase A11 SpiritCore Media Production System.

The new operator route is:

- `POST /admin/media/production-sequence-plan`

It returns structured sequence plans for:

- `spiritgate_enhancement`
- `original_motion_pack`
- `premium_spiritkin_starter_pack`

The route does not run Runway, does not call any provider, does not promote assets, does not update manifests, and does not write to `ACTIVE`.

## SpiritGate Enhancement Plan

Primary target:

- `targetId`: `spiritgate`
- source concept: existing Pika Labs SpiritGate video
- sequence type: `spiritgate_enhancement`

The enhancement sequence is designed to improve:

- quality
- cinematic polish
- lighting
- clarity
- dimensionality
- atmosphere
- premium feel
- Spiritverse identity

Required SpiritGate controls:

- `originalReplacementAllowed: false`
- `sourceConceptMustBePreserved: true`
- `enhancementOnly: true`
- `reviewRequiredBeforePromotion: true`
- `rollbackRequired: true`

The existing SpiritGate video remains the source concept and must not be replaced automatically.

## Original Spiritkin Motion Pack Plan

Original Spiritkin motion pack planning is supported for:

- Lyra
- Raien
- Kairo
- Elaria
- Thalassar

Each motion pack sequence plans:

- `idle_video`
- `speaking_video`
- `listening_video`
- `greeting_video`
- `wake_visual`
- `trailer_video`
- `presence_indicator`

These are plans only. Generated assets must later be created one at a time, reviewed, approved, and promoted manually.

## Premium Spiritkin Starter Pack Plan

Future premium user-created Spiritkins have a dedicated starter pack sequence.

Minimum paid-ready starter pack:

- `portrait`
- `hero` or `full_body`
- `icon`
- `presence_indicator`
- `room_background`
- `idle_video`
- `speaking_video`
- `greeting_video`
- `wake_visual`
- profile metadata
- review status
- promotion status

The planner marks premium Spiritkins as not paid-ready until required assets are reviewed and approved.

## Assistant Capability Alignment

Assistant-like features should be implemented as separate Spiritverse-native capability packs, not inside the media production system.

Future capability packs should include:

- alarms
- reminders
- wake calls
- music/audio actions
- daily routines
- calendar support
- task support
- games
- learning/play modes
- emotional check-ins
- family-safe interaction modes
- future smart-home integration

Product principle: Spiritkins must not copy Alexa, Google Assistant, Replika, Character.AI, Disney, Jurassic Park, or any competitor. It should meet baseline user expectations through original, premium, emotionally intelligent Spiritverse-native experiences.

## Readiness Checks

The production sequence route returns:

- `sequenceId`
- `sequenceType`
- `targetId`
- `sourceAssetRefs`
- `generationPlans`
- `promptTemplates`
- `reviewChecklist`
- `rejectionCriteria`
- `promotionPlanPlaceholders`
- `continuityRequirements`
- `estimatedProviderNeeds`
- `operatorApprovalRequired: true`
- `noGenerationPerformed: true`
- `noProviderCall: true`
- `noPromotionPerformed: true`
- `noManifestUpdatePerformed: true`
- `noActiveWritePerformed: true`

## Review Checklist

Every sequence requires:

- operator target confirmation
- source reference confirmation
- identity continuity review
- lore consistency review
- safety review
- mobile and desktop framing review
- no overwrite of existing active assets
- provider job and prompt metadata capture before any future promotion

SpiritGate adds:

- original Pika Labs concept remains recognizable
- enhancement remains an upgrade, not a replacement
- gateway scene compatibility remains intact
- rollback path is prepared before promotion

## Rejection Criteria

Reject sequence outputs if they show:

- identity drift
- unsafe framing
- watermarks or text overlays
- off-brand stock-like composition
- unclear mobile framing
- missing prompt/provider metadata
- wrong asset kind
- broken SpiritGate source identity
- intrusive or distracting motion states
- incomplete premium paid-ready starter pack

## Promotion Placeholders

Promotion placeholders are generated for operator planning only.

They include:

- review path
- approved path
- active path
- public path
- metadata path
- rollback path
- manifest target placeholder
- required checks

No placeholder writes files or updates manifests.

## Exact Next Recommended Runway Action

Next action: run one staging-only SpiritGate enhancement dry production request after operator review of the sequence plan.

Recommended first future execution target:

- `sequenceType`: `spiritgate_enhancement`
- `targetId`: `spiritgate`
- `assetKind`: `spiritgate_video`
- source reference: existing Pika Labs SpiritGate video
- `safetyLevel`: `internal_review`
- output lifecycle: `review_required`

Do not promote it until the review checklist passes and a separate promotion plan is approved.

## Confirmation

No generation occurred in Phase A12.

No provider call occurred.

No promotion occurred.

No manifest update occurred.

No `ACTIVE` write occurred.
