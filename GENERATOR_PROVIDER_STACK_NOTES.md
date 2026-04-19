# Generator Provider Stack Notes

## Providers Integrated

- Image provider stack:
  - `Flux via ComfyUI` as the preferred primary path when `FLUX_COMFYUI_BASE_URL` and `FLUX_COMFYUI_WORKFLOW_PATH` are configured.
  - `Flux API` as the hosted primary alternative when `FLUX_API_URL` and `FLUX_API_KEY` are configured.
  - `Leonardo` as an optional image fallback when `LEONARDO_API_KEY` is configured.
- Video provider stack:
  - `Runway` for trailer and scene-based video generation when `RUNWAY_API_KEY` is configured.

## What Works Now

- Generator jobs can be created for image and video outputs through the Command Center.
- Image and video jobs can execute through provider-agnostic adapter methods:
  - `generateImage(spec)`
  - `refineImage(spec)`
  - `upscaleImage(spec)`
  - `generateVideo(spec)`
  - `extendVideo(spec)`
- The generator service now wires:
  - spec builder -> provider adapter
  - provider result -> local artifact storage
  - local artifact storage -> review queue
  - review approval -> Spiritkin runtime attachment
- Specs are preserved even when provider execution fails.
- Failed runs store real error state and can be retried from the Command Center.
- Generated artifacts are stored under:
  - `runtime_data/generated-spiritkins/...`
  - served at runtime through `/generated-spiritkins/...`
- Metadata sidecars are written beside artifacts so prompt/spec history stays attached to each output version.

## Data / Storage Model

- Store ledger:
  - `runtime_data/spiritkin_generator_foundation_v1.json`
- Artifact layout:
  - `/generated-spiritkins/canonical/<spiritkin>/drafts/...`
  - `/generated-spiritkins/canonical/<spiritkin>/approved/...`
  - `/generated-spiritkins/canonical/<spiritkin>/rejected/...`
  - same shape for `user-created`
- Each approved artifact writes:
  - `artifact.<ext>`
  - `metadata.json`

## Flux Integration Notes

- ComfyUI mode expects a workflow template file path:
  - `FLUX_COMFYUI_WORKFLOW_PATH`
- The workflow file should use token placeholders like:
  - `{{prompt}}`
  - `{{negativePrompt}}`
  - `{{seed}}`
  - `{{width}}`
  - `{{height}}`
  - `{{guidance}}`
  - `{{steps}}`
  - `{{model}}`
  - `{{styleProfile}}`
  - `{{loraHooks}}`
- Hosted Flux API mode supports:
  - prompt
  - negative prompt
  - seed
  - width / height
  - guidance scale
  - steps
  - style profile
  - source assets
  - future LoRA hooks

## Runway Integration Notes

- Runway execution supports:
  - trailer generation
  - scene-based prompt packages
  - attached image/assets
  - duration
  - aspect ratio
  - optional seed
- Runway outputs are stored the same way as images and remain reviewable before canonical attach.

## Style Consistency

- Image specs now support:
  - reusable `seed`
  - `styleProfile`
  - `loraHooks` placeholder fields
  - consistent prompt template composition
- Video specs support:
  - shot lists
  - seed
  - aspect ratio
  - consistent trailer prompt structure

## Failure Handling

- If no provider is configured:
  - the job is still saved
  - provider state remains `awaiting_provider`
  - the admin UI receives a real provider-unavailable response
- If a configured provider fails:
  - the job is marked `failed`
  - the output stores `lastError`
  - the saved spec remains retryable
- Leonardo is only used as image fallback when configured.

## What Still Needs API Keys / Provider Setup

- `FLUX_COMFYUI_BASE_URL` and workflow template, or `FLUX_API_URL` + `FLUX_API_KEY`
- `RUNWAY_API_KEY`
- optional `LEONARDO_API_KEY`

## What Is Ready For Production Use

- The orchestration and storage layer
- Provider-agnostic execution interface
- Retryable failure handling
- Runtime-serving of generated artifacts
- Canonical attach flow for Spiritkin profiles
- Premium-user-safe ownership model for future user-created Spiritkins

## Remaining External Dependencies

- Real provider credentials
- A ComfyUI workflow template for the exact Flux graph being used, if ComfyUI is the chosen primary path
- Any provider-specific quota, moderation, or cost controls not yet added
