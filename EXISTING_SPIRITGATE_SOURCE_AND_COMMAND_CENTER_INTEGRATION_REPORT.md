# Existing SpiritGate Source And Command Center Integration Report

## Current SpiritGate Source Found

The existing SpiritGate source video is already in the app.

- local file path: `spiritkins-app/public/videos/gate_entrance_final.mp4`
- frontend path: `/videos/gate_entrance_final.mp4`
- runtime config: `SPIRITGATE_RUNTIME_MEDIA.gate.path`
- runtime config file: `spiritkins-app/data/spiritkinRuntimeConfig.js`
- frontend usage: `<source src="/videos/gate_entrance_final.mp4" type="video/mp4">`
- frontend file: `spiritkins-app/app.js`
- server route: `GET /videos/:filename`
- source asset id: `existing-pika-spiritgate-video`
- source type for local app reference: `existing_asset`
- source type for staging Runway use: `external_url`

Staging URL candidate:

`https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4`

This is the existing app-served SpiritGate video path. No new storage system is needed for the first controlled staging test if Railway staging serves that URL publicly over HTTPS.

## Runway Usability

Runway video-to-video requires an HTTPS, Runway, or data video URI.

The local path `/videos/gate_entrance_final.mp4` is not enough by itself for Runway. The staging HTTPS URL above is the usable `sourceAssetRef` candidate if it returns the video to unauthenticated external requests.

If the staging URL is reachable by Runway:

- `sourceAssetRef`: `https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4`
- `sourceAssetType`: `external_url`
- provider mode: `video_to_video`
- model/tool: Runway `gen4_aleph`

If it is not reachable, the smallest fix is to expose the existing `spiritkins-app/public/videos/gate_entrance_final.mp4` file through the current `/videos/:filename` route on staging. Do not create a separate upload/storage system first.

## Command Center / Video Generator State

Current command center generator support exists at `/command-center`.

Reusable pieces:

- Generator tab
- Image generator form
- Video generator form
- Provider status display
- Generation history list
- Review queue
- Output review actions
- Generator job execute/retry actions

Incomplete for A14/A15 automation:

- no SpiritGate-specific source summary panel
- no SpiritGate enhancement payload preview
- no operator approval checkbox for A14 route
- no direct call to `/admin/media/spiritgate-enhancement-execute`
- no provider status polling tied to `/admin/runway/status-check`
- no media review-plan creation from completed SpiritGate output
- no explicit promotion controls for the new media production lifecycle

The command center can reuse its existing generator/review patterns later, but no UI was added in this phase.

## Routes Added

- `GET /admin/media/spiritgate-source-summary`
- `POST /admin/media/spiritgate-enhancement-plan-from-current-source`

Both routes are admin/operator routes and perform no generation.

## Source Resolver Behavior

`resolveExistingSpiritGateSource()` returns:

- current path
- local file path
- source asset id
- source type
- HTTPS public URL when request headers expose an HTTPS origin
- provider compatibility
- command-center generator readiness
- missing requirements if the source is not Runway-accessible

It does not write files, update manifests, promote assets, or touch ACTIVE.

## Enhancement Plan From Current Source

The current-source planning route builds a ready-to-run payload for:

`POST /admin/media/spiritgate-enhancement-execute`

The payload uses the existing SpiritGate video as `sourceAssetRef`, includes the optimized SpiritGate enhancement prompt, recommends Runway `video_to_video` with `gen4_aleph`, and keeps operator approval required.

## Diagnostics Result

`npm test` passed.

Endpoint diagnostics:

- pass count: 103
- skip count: 0
- fail count: 0

Schema diagnostics:

- read-only verification passed
- table checks passed
- column checks passed
- index checks remain unverified where Supabase does not expose `pg_catalog.pg_indexes`

Diagnostics confirmed:

- existing SpiritGate source discovery works
- source summary route returns no-generation flags
- source resolver performs no writes
- enhancement plan can be built from the current source
- no Runway generation occurs
- no provider call occurs
- no promotion occurs
- no manifest update occurs
- no ACTIVE write occurs
- premium member generation remains disabled
- command-center generator readiness is reported

## Exact Next Staging Command

Run this only after staging has this commit deployed and the staging source URL is confirmed reachable:

```powershell
$runwayKeySecure = Read-Host "Runway API key" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($runwayKeySecure)
try {
  $runwayKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $body = @{
    targetId = "spiritgate"
    sourceAssetRef = "https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4"
    sourceAssetType = "external_url"
    promptIntent = "Enhance the existing SpiritGate entrance video without replacing its identity. Preserve the recognizable source concept, timing, gateway silhouette, threshold feeling, and Spiritverse arrival energy. Improve quality, cinematic polish, lighting, clarity, dimensionality, atmosphere, and premium feel."
    styleProfile = "premium cinematic cosmic fantasy, luxury black and gold, subtle apple red accents, ivory highlights, Spiritverse gateway identity"
    safetyLevel = "internal_review"
    operatorApproval = $true
    runwayTransientKey = $runwayKey
  } | ConvertTo-Json -Depth 6

  Invoke-RestMethod `
    -Uri "https://spiritcore-backend-copy-production.up.railway.app/admin/media/spiritgate-enhancement-execute" `
    -Method Post `
    -Headers @{
      "x-runway-transient-execute" = "true"
      "x-runway-transient-provider-execution" = "true"
    } `
    -ContentType "application/json" `
    -Body $body
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable runwayKey -ErrorAction SilentlyContinue
}
```

Required staging gates:

- `NODE_ENV=staging`
- `RUNWAY_STAGING_TEST_BYPASS=true`
- `RUNWAY_DRY_RUN_EXECUTE=true`
- `RUNWAY_ALLOW_PROVIDER_EXECUTION=true`

For the one controlled staging test, the route can also satisfy those two execution flags request-scoped through the transient headers shown above when `runwayTransientKey` is present in the body. The route does not modify global environment variables.

## Confirmation

No Runway generation occurred during A15.

No provider call occurred.

No promotion occurred.

No manifest update occurred.

No ACTIVE write occurred.

Premium member generation remains disabled.

The existing SpiritGate video was not overwritten or replaced.
