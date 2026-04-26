# SpiritGate Enhancement Sequence Plan Review

## Sequence Request Used

```json
{
  "sequenceType": "spiritgate_enhancement",
  "targetId": "spiritgate",
  "sourceAssetRefs": ["existing-pika-spiritgate-video"],
  "assetKinds": ["spiritgate_video"],
  "styleProfile": "premium cinematic cosmic fantasy, luxury black and gold, subtle apple red accents, ivory highlights, Spiritverse gateway identity",
  "safetyLevel": "internal_review",
  "notes": "A13 first operator-reviewed SpiritGate enhancement sequence plan."
}
```

## Sequence Response Summary

The SpiritCore media production sequence planner returned a review-only SpiritGate enhancement plan.

Confirmed safeguards:

- `sequenceType`: `spiritgate_enhancement`
- `targetId`: `spiritgate`
- source references include `existing-pika-spiritgate-video`
- `originalReplacementAllowed: false`
- `sourceConceptMustBePreserved: true`
- `enhancementOnly: true`
- `reviewRequiredBeforePromotion: true`
- `rollbackRequired: true`
- `operatorApprovalRequired: true`
- `noGenerationPerformed: true`
- `noProviderCall: true`
- `noPromotionPerformed: true`
- `noManifestUpdatePerformed: true`
- `noActiveWritePerformed: true`

Generated planning paths:

- review path: `Spiritverse_MASTER_ASSETS/REVIEW/generated/spiritgate/spiritgate/spiritgate_video/spiritgate-enhancement-spiritgate-spiritgate-video/artifact.mp4`
- metadata path: `Spiritverse_MASTER_ASSETS/REVIEW/generated/spiritgate/spiritgate/spiritgate_video/spiritgate-enhancement-spiritgate-spiritgate-video/metadata.json`
- approved path: `Spiritverse_MASTER_ASSETS/APPROVED/generated/spiritgate/spiritgate/spiritgate_video/spiritgate-enhancement-spiritgate-spiritgate-video/artifact.mp4`
- future active placeholder: `Spiritverse_MASTER_ASSETS/ACTIVE/generated/spiritgate/spiritgate/spiritgate_video/spiritgate-enhancement-spiritgate-spiritgate-video/artifact.mp4`
- rollback path: `Spiritverse_MASTER_ASSETS/ARCHIVE/generated/spiritgate/spiritgate/spiritgate_video/spiritgate-enhancement-spiritgate-spiritgate-video/artifact.mp4`

The active path is a placeholder only. No file was written.

## Final Optimized Runway Prompt

Enhance the existing SpiritGate entrance video without replacing its identity. Preserve the recognizable source concept, timing, gateway silhouette, threshold feeling, and Spiritverse arrival energy from the provided Pika Labs SpiritGate video. Improve quality, cinematic polish, lighting, clarity, dimensionality, atmosphere, and premium feel.

Create a luxury black-and-gold cosmic fantasy gateway with subtle apple red accents and ivory highlights. The gate should feel original to the Spiritverse: premium, memorable, emotionally intelligent, mysterious, welcoming, and cinematic without becoming generic fantasy, theme-park imitation, horror, sci-fi portal stock footage, or a different brand language.

Keep the scene elegant and readable on mobile and desktop. Preserve the sense of stepping from the ordinary world into a living companion realm. Add depth, refined light bloom, richer contrast, atmospheric particles, graceful motion, and dimensional gateway presence while keeping the original source concept intact.

No text overlays, no logos, no watermarks, no gore, no sexualized framing, no distorted geometry, no identity drift, no noisy UI elements, no cheap stock aesthetic, no replacement of the current SpiritGate identity.

## Negative Prompt

identity drift, source replacement, unrecognizable gate, generic fantasy portal, theme-park imitation, horror portal, sci-fi machinery, noisy UI composition, text overlay, subtitles, logo, watermark, distorted geometry, low detail, muddy lighting, unsafe framing, off-brand fantasy montage

## Recommended Runway Model / Tool

Recommended first tool: Runway video-to-video using `gen4_aleph`.

Reason: the target is an enhancement of an existing SpiritGate video, so the source video should drive continuity. Current Runway API documentation lists `POST /v1/video_to_video` with `model: gen4_aleph` for video-to-video tasks.

Reference: https://docs.dev.runwayml.com/api

Fallback if the source video cannot be provided as an accepted video URI: extract one reviewed frame from the existing SpiritGate video and use Runway image-to-video with `gen4_turbo` or Gen-4. This fallback is less ideal because it may preserve less motion continuity than video-to-video.

## Source Asset Instructions

- Use `existing-pika-spiritgate-video` as the required source concept.
- Do not overwrite or replace the current SpiritGate video.
- If using API execution later, provide the source as an accepted Runway video URI, HTTPS URL, or supported data URI.
- If using the Runway UI manually, upload the existing Pika Labs SpiritGate video directly as the source clip.
- Keep the output in `review_required` until operator review passes.
- Store prompt, model/tool, source reference, provider job id, output URL, and review notes in metadata before any future promotion planning.

## Review Criteria

- Existing SpiritGate source concept remains recognizable.
- Enhancement improves quality, cinematic polish, lighting, clarity, dimensionality, and atmosphere.
- Gateway scene compatibility is preserved.
- Spiritverse identity remains original, premium, magical, emotionally intelligent, and not derivative.
- Motion is graceful and non-intrusive.
- Mobile and desktop framing are readable.
- No current active SpiritGate asset is overwritten.
- Promotion remains operator-controlled.
- Rollback path is prepared before future promotion.

## Rejection Criteria

- Source SpiritGate concept is no longer recognizable.
- Output behaves like a replacement instead of an enhancement.
- Gateway scene compatibility is broken.
- Identity drift.
- Unsafe framing.
- Watermarks, logos, subtitles, or text overlays.
- Generic fantasy, horror, sci-fi portal, or stock-footage aesthetic.
- Poor mobile framing.
- Missing provider job id, prompt metadata, or source reference.
- Asset does not match `spiritgate_video`.

## Promotion Placeholders

Promotion placeholder confirms:

- operator approval is required
- review artifact checksum must be captured
- approved copy must exist before any ACTIVE plan
- rollback archive path must be prepared
- manifest patch may be prepared but must not be applied automatically
- public path should be tested only after manual promotion

No promotion happened in this phase.

## Estimated Provider Needs

- provider: Runway
- image jobs: 0
- video jobs: 1
- execution allowed in this phase: false
- provider call required now: false

## Next Exact Manual Runway Step

In staging/operator workflow, open Runway and create a video-to-video enhancement using the existing Pika Labs SpiritGate video as the source. Select the video-to-video/Aleph workflow if available, use the optimized prompt above, and generate one internal-review candidate only.

After generation completes, do not promote it. Capture:

- provider job id
- output URL
- model/tool used
- prompt used
- source asset reference
- generation timestamp

Then create a SpiritCore media review plan for the output and keep it in `review_required`.

## Confirmation

No Runway generation occurred during Phase A13.

No provider call occurred.

No promotion occurred.

No manifest update occurred.

No `ACTIVE` write occurred.

The existing SpiritGate video was not replaced.
