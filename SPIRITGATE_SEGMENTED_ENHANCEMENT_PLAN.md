# SpiritGate Segmented Enhancement Plan

## Why Segmentation Is Required

The A15 automated Runway `video_to_video` test succeeded, but Runway returned a 5-second enhanced MP4. The current in-app SpiritGate source video is longer, so a complete enhancement must be planned as reviewed 5-second segments rather than a single full-length generation.

This phase does not run Runway generation. It creates the controlled plan needed to avoid wasting credits.

## Source Metadata

Local metadata inspection used a read-only Node MP4 container check because `ffprobe` is not installed in this environment.

- source file: `spiritkins-app/public/videos/gate_entrance_final.mp4`
- staging source URL: `https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4`
- duration: `43.349` seconds
- resolution: `1280x720`
- file size: `13,635,449` bytes
- `ffprobe` availability: not installed
- recommended segment duration: `5` seconds
- recommended segment count: `9`

Useful metadata command if ffprobe is later available:

```powershell
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,r_frame_rate,codec_type -of json spiritkins-app\public\videos\gate_entrance_final.mp4
```

## Route Added

- `POST /admin/media/spiritgate-segment-plan`

The route returns segment definitions, prompts, continuity rules, review rules, waste-control strategy, and stitching plan. It performs no generation and no provider call.

## Segment List

| Segment | Time Range | Purpose | Mode |
| --- | --- | --- | --- |
| 1 | 0.000-5.000 | Gate awakening / first reveal | enhancement-only |
| 2 | 5.000-10.000 | Approach / energy build | enhancement-only |
| 3 | 10.000-15.000 | Threshold formation | enhancement-only |
| 4 | 15.000-20.000 | Deepening portal / dimensional movement | enhancement-only |
| 5 | 20.000-25.000 | Deepening portal / dimensional movement | enhancement-only |
| 6 | 25.000-30.000 | Deepening portal / dimensional movement | enhancement-only |
| 7 | 30.000-35.000 | Final approach | transition-improvement |
| 8 | 35.000-40.000 | Crossing into Spiritverse | transition-improvement |
| 9 | 40.000-43.349 | Spiritverse reveal / arrival settle | transition-improvement |

## Final Entrance Improvement Strategy

The final two to three segments should receive stronger transition prompts than the opening continuity segments.

Goals:

- smoother flow into Spiritverse
- stronger threshold crossing
- more cinematic final movement
- emotionally complete arrival
- visual continuity with the original source
- no abrupt ending

Final segment prompt requirement:

The final arrival segment must improve flow into the Spiritverse, create a smoother threshold crossing, resolve motion gracefully, feel emotionally complete, preserve visual continuity, and avoid an abrupt ending.

## Waste-Control Strategy

Do not generate all segments first.

Recommended sequence:

1. Generate only Segment 1 as the first paid test.
2. Review for SpiritGate identity, motion stability, source preservation, and Aleph quality.
3. Continue only if Segment 1 passes review.
4. Generate one middle continuity segment next, preferably Segment 4, to test continuity away from the opening.
5. Generate the final transition segment after continuity quality is proven.
6. Stop immediately if identity drift, unstable motion, generic portal styling, or poor stitching boundaries appear.

Credit controls:

- track credits per segment
- keep each output in `review_required`
- require operator approval before continuing a batch
- avoid generating remaining segments if the first test fails
- avoid stitching until every segment is reviewed

## Review And Stitching Plan

Enhanced clips remain `review_required`.

Each segment must be reviewed independently for:

- source identity preservation
- quality improvement
- stitchable first and last frames
- no watermark, logo, subtitle, or visible provider artifact
- no off-brand portal language
- final crossing feels smooth and emotionally complete

Approved segments should later be stitched in order. The stitched full-length SpiritGate video becomes a new review candidate, not an active asset. Final operator approval is required before any manifest update or ACTIVE write.

No stitching was implemented in this phase.

## Next Exact Recommended First Segment Test

Generate Segment 1 only:

- source: `https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4`
- source range: `0.000-5.000`
- purpose: Gate awakening / first reveal
- model/tool: Runway `video_to_video` with `gen4_aleph`
- lifecycle: `review_required`

Prompt:

Enhance SpiritGate segment 1 of 9: Gate awakening / first reveal. Preserve the existing SpiritGate source identity, gateway silhouette, timing feel, luxury black-and-gold atmosphere, subtle apple red accents, and ivory highlights. Improve cinematic polish, clarity, lighting, dimensionality, motion fluency, and premium emotional presence without replacing the source concept. Open with a clear awakening of the gate: elegant, anticipatory, readable, and faithful to the current entrance. No text overlays, logos, watermarks, horror shift, generic portal look, noisy UI elements, identity drift, or abrupt visual discontinuity.

## Diagnostics

`npm test` passed.

Endpoint diagnostics verified:

- segment planning route exists
- 43.349 seconds at 5-second segments creates 9 segments
- final segment receives transition-improvement prompt
- no generation occurs
- no provider call occurs
- no promotion occurs
- no manifest update occurs
- no ACTIVE write occurs
- premium generation remains disabled

## Confirmation

No Runway generation occurred.

No provider call occurred.

No promotion occurred.

No manifest update occurred.

No ACTIVE write occurred.

The current SpiritGate video was not replaced.
