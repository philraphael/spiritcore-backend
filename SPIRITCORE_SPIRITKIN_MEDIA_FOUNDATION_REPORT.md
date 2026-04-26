# SpiritCore / Spiritkin Media Foundation Report

## Phase B1 Summary

Phase B1 adds a safe planning foundation for SpiritCore as the default operator experience, optional Spiritkins under SpiritCore governance, reusable Spiritkin motion packs, SpiritCore avatar media packs, and review-first video assembly planning.

No Runway generation was executed. No media was promoted. No manifests were updated. No ACTIVE assets were written.

## SpiritCore Default Operator Model

The backend now supports a default operator planning model with:

- `defaultOperatorType`: `spiritcore` or `spiritkin`
- `spiritcoreProfile`
- optional `spiritkinProfiles[]`
- separate entitlement flags for `spiritcorePremium` and `spiritkinPremium`

The model explicitly treats SpiritCore as the universal default operator. Spiritkins remain optional companion entities governed by SpiritCore in-universe. Existing Spiritkin-first flows remain compatible and are not removed.

Route:

- `POST /admin/media/operator-experience-plan`

For staging route verification only, approved planning-only media routes may use the `x-media-planning-test: true` header when `NODE_ENV=staging` and either `RUNWAY_STAGING_TEST_BYPASS=true` or `MEDIA_STAGING_TEST_BYPASS=true`. This bypass is limited to planning routes and does not apply to Runway or SpiritGate execution routes.

## Optional Spiritkin Companion Model

Spiritkin profiles can be included as optional companion profiles under the SpiritCore default operator plan. This preserves current Spiritkins behavior while allowing a user to use SpiritCore without choosing or activating a Spiritkin.

Premium separation is modeled as:

- SpiritCore premium: operator, assistant, wake, routine, and utility capability lane
- Spiritkin premium: companion identity, motion, voice, memory, and media pack lane
- Compatible but independently grantable entitlements

## SpiritCore Avatar Pack Planning

The SpiritCore avatar lane is planning-only and supports:

- `avatarType: human_agent`
- serious, premium, cinematic, elegant tone
- idle states
- speaking states
- gesture states
- seated/listening states
- thinking states
- entrance and realm-presence states

Route:

- `POST /admin/media/spiritcore-avatar-pack-plan`

All planned assets remain `review_required`. The pack is not ready for generation in this phase.

## Spiritkin Motion Pack Planning

The reusable Spiritkin motion pack model supports:

- `idle_01`
- `idle_02`
- `speaking_01`
- `speaking_02`
- `listen_01`
- `think_01`
- `gesture_01`
- `gesture_02`
- `walk_loop_01`
- `sit_or_perch_01`
- `greeting_or_entry_01`

Route:

- `POST /admin/media/spiritkin-motion-pack-plan`

Each planned asset includes asset type, target, subject, purpose, source references, prompt intent, style profile, motion category, state trigger, review status, and lifecycle state.

## Video Assembly Foundation

The media assembly foundation supports sequence video planning from source clips or URLs. It validates segment timing, estimates output duration, defines a review path candidate, and returns review-first lifecycle metadata.

Routes:

- `POST /admin/media/assembly-plan`
- `POST /admin/media/assemble-video`

`ffmpeg` is not available in the current local environment. Because of that, `/admin/media/assemble-video` returns a safe planned-only response and does not write output files. The route is present so a future reviewed ffmpeg adapter can be enabled without changing the command-center contract.

Current ffmpeg status:

- `ffmpegAvailable: false`
- `ffmpegExecutionEnabled: false`
- stitch method: `planned_adapter_only`

## Review-First Lifecycle

All B1 media planning outputs remain:

- `lifecycleState: review_required` for planned media outputs
- no provider calls
- no generation
- no promotion
- no manifest update
- no ACTIVE write

The assembly plan produces review candidates only. Actual promotion remains operator-controlled through the existing review and promotion pipeline.

## Premium Self-Generation Boundary

Premium member self-generation remains disabled. Required future systems before enabling it include:

- user creation form
- safety moderation
- style governance
- generation budget and credit limits
- starter asset pack requirements
- failed generation recovery
- review and approval mode
- storage strategy
- voice, wake, and motion completeness
- user-facing status messaging

## Diagnostics

Diagnostics were extended to verify:

- SpiritCore default operator planning
- staging media planning bypass for planning-only routes
- production denial for the media planning bypass
- execution route denial for the media planning bypass
- SpiritCore premium and Spiritkin premium entitlement separation
- Spiritkin motion pack planning
- SpiritCore avatar pack planning
- assembly planning
- assemble-video safe planned-only behavior
- no provider generation in planning routes
- no promotion
- no manifest update
- no ACTIVE write
- premium self-generation remains disabled

## Next Recommended Step

Call this route first:

```http
POST /admin/media/operator-experience-plan
```

Use it to confirm the product-level default operator shape before generating or assembling any new media. After that, call:

```http
POST /admin/media/spiritkin-motion-pack-plan
```

for one original Spiritkin, then use:

```http
POST /admin/media/assembly-plan
```

to plan review-only assembly of approved test clips.

## Confirmations

- No generation occurred.
- No provider call occurred.
- No promotion occurred.
- No manifest update occurred.
- No ACTIVE write occurred.
- Existing Spiritkins functionality was preserved.
- Existing SpiritGate/media flows were preserved.
