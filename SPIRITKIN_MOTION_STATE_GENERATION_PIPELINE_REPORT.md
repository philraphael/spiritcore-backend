# Spiritkin Motion State Generation Pipeline Report

## Phase B2 Summary

Phase B2 adds a controlled backend pipeline for one operator-reviewed Spiritkin motion-state generation. The first intended target is Lyra `speaking_01`, generated as a `speaking_video` from an existing approved still reference.

No generation was run during tests. No provider calls were made during tests. No media was promoted. No manifests were updated. No ACTIVE assets were written.

## Existing Lyra Source Discovery

Current canonical Lyra still source:

- local file: `spiritkins-app/public/portraits/lyra_portrait.png`
- runtime path: `/portraits/lyra_portrait.png`
- staging URL: `https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png`
- source type: `external_url` when called from staging with forwarded HTTPS origin
- source asset id: `existing-lyra-portrait-source`
- approved for reference: `true`
- Runway suitability: usable for image-to-video if the staging URL is publicly reachable

The source comes from the existing Spiritkin media manifest and is canonical enough for the first Lyra speaking-state motion test.

## Routes Added

- `GET /admin/media/spiritkin-source-summary/:spiritkinId`
- `POST /admin/media/spiritkin-motion-state-execute`

The source summary route performs no generation and no writes. The execution route is staging-only and review-first.

## Provider Mapping

For the first Lyra target:

- `assetType`: `speaking_01`
- `assetKind`: `speaking_video`
- source: still image
- provider mode: `image_to_video`
- recommended model: `gen4_turbo`
- endpoint: `/v1/image_to_video`
- status check: existing `POST /admin/runway/status-check`

The route rejects text-to-image usage for Spiritkin motion-state execution. Video-to-video is reserved only for future video sources.

## Safety Gates

Execution requires:

- `NODE_ENV=staging`
- `RUNWAY_STAGING_TEST_BYPASS=true` or `MEDIA_STAGING_TEST_BYPASS=true`
- `operatorApproval=true`
- existing allowed `spiritkinId`
- valid motion-pack `assetType`
- matching `assetKind`
- `sourceAssetRef`
- `safetyLevel=internal_review`
- provider execution gates for any real call
- transient key plus transient execution headers for request-scoped test execution

The route never auto-promotes, never updates manifests, and never writes ACTIVE assets.

## Command Center Readiness

The execution response includes:

- provider target
- API payload preview
- media asset record
- review path / approved path / active path / rollback path
- status-check route reference
- generation status
- review status
- `premiumMemberGeneration.enabled=false`

This gives a future command center enough data to show source, model, job state, review status, and promotion lockout.

## Premium Member Generation Boundary

Premium member self-generation remains disabled. The route is operator/staging controlled and does not expose generation to normal users.

## Exact Next Staging Command

Use this only after staging has redeployed this commit and the Lyra portrait URL is reachable:

```powershell
$runwayKey = Read-Host "Runway API key"

$body = @{
  spiritkinId = "lyra"
  targetId = "lyra-motion-pack-v1"
  assetType = "speaking_01"
  assetKind = "speaking_video"
  sourceAssetRef = "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png"
  sourceAssetType = "external_url"
  promptIntent = "Animate Lyra into a premium speaking loop for SpiritCore responses. Preserve her canonical portrait identity, gentle luminous presence, calm emotional precision, and elegant Spiritverse companion tone. Subtle natural face and upper-body motion only, suitable for repeated assistant speaking state."
  styleProfile = "premium cinematic Spiritverse companion, elegant, emotionally alive, luxury fantasy, not childish, screen-present avatar realism"
  safetyLevel = "internal_review"
  operatorApproval = $true
  runwayTransientKey = $runwayKey
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Method Post `
  -Uri "https://spiritcore-backend-copy-production.up.railway.app/admin/media/spiritkin-motion-state-execute" `
  -Headers @{
    "x-runway-transient-execute" = "true"
    "x-runway-transient-provider-execution" = "true"
  } `
  -ContentType "application/json" `
  -Body $body
```

Do not run this until the operator confirms staging variables and source URL accessibility.

## Fallback If Source Is Not Usable

If the source summary reports a missing requirement:

1. Confirm `GET /portraits/lyra_portrait.png` returns 200 on staging.
2. Confirm the staging URL is HTTPS and externally reachable.
3. Use the existing portrait route rather than creating a new storage system.
4. Re-run `GET /admin/media/spiritkin-source-summary/lyra` with the staging host headers or through deployed staging.

## Diagnostics

Diagnostics verify:

- Lyra source resolver finds the canonical portrait source
- source summary route returns safe no-write flags
- Runway failed task status parsing returns sanitized `failureCode` and `failureMessage`
- motion-state execution route exists
- missing source is rejected
- missing operator approval is blocked
- production bypass is denied
- valid staging preview builds image-to-video payload
- transient execution flags work in mock path
- generated output remains `review_required`
- premium member generation remains disabled
- no auto-promotion
- no manifest update
- no ACTIVE write

## Status Check Failure Details

`POST /admin/runway/status-check` now preserves sanitized Runway task failure details for operator review:

- `providerStatus`
- `providerHttpStatus`
- `failure`
- `failureCode`
- `failureMessage`
- `error`
- `responseKeys`

For a failed Runway task such as `INTERNAL.BAD_OUTPUT.CODE01`, SpiritCore returns `ok: false`, keeps output URLs empty, and still confirms no promotion, manifest update, or ACTIVE write occurred.

## Safer B2.1 Motion Controls

The first Lyra `speaking_01` image-to-video job was accepted by Runway but failed during provider output generation:

- provider job id: `5d7764c2-47f4-4653-b69d-5e385e667195`
- status: `FAILED`
- failure code: `INTERNAL.BAD_OUTPUT.CODE01`
- failure message: `An unexpected error occurred.`

The SpiritCore route, source URL, auth, gates, and review lifecycle worked. The failure occurred inside Runway generation. To reduce paid-generation waste, the motion-state execution route now accepts safer controls:

- `durationSec`: `5` or `8`, default `5`
- `ratio` / `aspectRatio`: default `720:1280`; supported values are `1280:720`, `720:1280`, `1104:832`, `832:1104`, `960:960`, and `1584:672`
- `motionIntensity`: `low` or `medium`, default `low`
- `generationMode`: `diagnostic_idle`, `subtle_speaking`, or `speaking`, default `diagnostic_idle`
- `allowMouthMovement`: boolean, default `false`

The recommended next test is Lyra `idle_01`, not `speaking_01`:

- `assetType`: `idle_01`
- `assetKind`: `idle_video`
- `durationSec`: `5`
- `motionIntensity`: `low`
- `generationMode`: `diagnostic_idle`
- `allowMouthMovement`: `false`

`diagnostic_idle` prompts only for blinking, breathing, and tiny natural head movement. It explicitly avoids speaking demands and mouth movement. Lyra `speaking_01` should be retried only after the idle diagnostic succeeds.

The `diagnostic_idle` provider prompt is now intentionally concise, under 700 characters, and does not append duplicate style/source/safety paragraphs. It asks only for a subtle idle presence loop while preserving portrait identity and explicitly blocks speaking, mouth movement, camera movement, background changes, text, and logos.

## Provider Request 400 Transparency

The first safer Lyra `idle_01` diagnostic attempt reached the SpiritCore execution route but failed before Runway created a task:

- route: `POST /admin/media/spiritkin-motion-state-execute`
- error: `SPIRITKIN_MOTION_STATE_EXECUTE_ERROR`
- provider message observed by the route: `Runway provider request failed with status 400.`
- previous response detail gap: `{}` did not expose the sanitized provider body.

Provider request errors now return sanitized diagnostic fields:

- `providerHttpStatus`
- `providerBodyKeys`
- `providerErrorMessage`
- `providerErrorCode`
- `endpointPath`
- `model`
- `providerMode`
- `payloadPreview`
- `providerBodyIssues`
- `providerDocUrl`

The payload preview intentionally excludes secrets and internal control fields. For Lyra `idle_01`, the provider payload is constrained to Runway `image_to_video` fields only:

- `model`
- `promptImage`
- `promptText`
- `ratio`
- `duration`

The next paid retry should happen only after inspecting the sanitized provider 400 body from staging and confirming whether Runway rejected ratio, source image access, prompt shape, or another request field.

After the sanitized response showed Runway body validation with hidden `issues`, the actual `gen4_turbo` `/v1/image_to_video` provider response confirmed this accepted ratio list:

- `1280:720`
- `720:1280`
- `1104:832`
- `832:1104`
- `960:960`
- `1584:672`

The previous `768:1280` correction was removed because it is not in the provider-confirmed list for this endpoint/model. The next Lyra `idle_01` retry should use `ratio: "720:1280"`.

## Confirmations

- No generation occurred in tests.
- No provider call occurred in tests.
- No promotion occurred.
- No manifest update occurred.
- No ACTIVE write occurred.
