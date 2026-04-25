# Post-Hardening Runway Readiness Report

Date: 2026-04-25

Scope: reassessment after Phase A1-A5 hardening commits:

- `3ef95d9` media manifest and missing asset fallback
- `5c35d8b` root validation scripts
- `23f1fea` legacy route gate
- `1b0e4c5` schema verification
- `333febd` speech route hardening

No Runway integration, code changes, schema changes, or refactors were performed in this phase.

## Executive Result

- Updated production readiness score: **76 / 100**
- Updated Runway readiness: **Yes for integration planning and provider-connection design; no for automatic production execution yet.**
- Updated beta readiness: **No for public beta; conditionally yes for a controlled closed beta after production env verification and privacy copy review.**

The project is now ready to begin a focused Runway integration planning phase because the largest pre-Runway operational gaps have been reduced: missing video retry behavior is controlled, validation can run through `npm test`, legacy routes are gated in production, live schema assumptions are checked read-only, and speech/TTS has bounded validation and error behavior.

It is not ready to turn Runway on for production users automatically. Runway should first be wired behind admin/operator execution, explicit job states, review gates, cost limits, and manifest promotion rules.

## Current Readiness By Area

### Media / Asset Readiness

Status: **Improved, planning-ready.**

- Spiritkin media is now manifest-driven for `portrait`, `heroImage`, `trailerVideo`, `idleVideo`, `speakingVideo`, `calmVideo`, and `fallbackImage`.
- Known-unavailable videos resolve to no URL, so the app no longer repeatedly requests known-missing idle/speaking/calm videos.
- Video errors are session-suppressed and fall back to still imagery.
- Lyra, Raien, Kairo, Solis, and Neris have explicit manifest mappings.
- Future custom and premium Spiritkins have a compatible slot model.

Remaining risk: the manifest is a frontend availability contract, not yet a full generated-asset promotion system. Runway outputs still need review, durable storage, and manifest attachment rules.

### Route / Security Readiness

Status: **Improved, controlled.**

- `/runtime/*` and `/v0/*` legacy routes are gated in production unless `ENABLE_LEGACY_ROUTES=true`.
- Local diagnostics remain compatible.
- Legacy route use logs warnings when allowed.
- Frontend dependency on legacy routes was not found.
- `/v1/speech` now validates inputs, applies a route-specific rate cap, and returns structured safe errors.

Remaining risk: production deployment should still verify `ADMIN_AUTH_MODE=enforce`, `ADMIN_API_KEY`, and explicit `CORS_ORIGIN`. Public v1 write routes remain broadly accessible by known user IDs and should receive a separate auth/session ownership pass before public beta.

### Schema Readiness

Status: **Mostly verified for required public contract.**

- Read-only schema diagnostic confirms required tables are present.
- Required columns for `memories`, `episodes`, `emotion_state`, `world_state`, and `user_engagement` are present.
- No schema modifications were performed.

Remaining risk: two uniqueness/index expectations remain unverified because `pg_catalog` is not exposed through the current Supabase REST configuration:

- `user_engagement` unique on `user_id + spiritkin_id`
- `emotion_state` unique on `user_id + spiritkin_id + conversation_id`

Before public beta, verify those through Supabase SQL editor, a restricted read-only RPC, or deployment-managed migration metadata.

### Speech / Wake Readiness

Status: **Improved for beta-adjacent use.**

- Auto mic remains disabled.
- Wake mode remains foreground/manual-arm behavior, not background native wake.
- `/v1/speech` rejects invalid payloads before provider calls.
- Speech max text length is 1200 characters.
- Allowed voices are `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`.
- Provider failures return structured text-only fallback errors.

Remaining risk: microphone/transcript/memory retention disclosure should still be reviewed before any public beta.

### PWA / Mobile Readiness

Status: **Functional but not fully beta-hardened.**

- PWA shell, manifest, service worker registration, mobile viewport, and route diagnostics are present.
- Browser syntax checks pass for the app and games runtime.

Remaining risk: service worker cache naming is still static, browser/mobile smoke tests are not part of `npm test`, and the large full-root render architecture remains a mobile stability risk during voice, games, and media playback.

### Frontend Stability

Status: **Better media behavior, same structural risk.**

- Missing media retry and console noise were reduced.
- Media fallback behavior is safer for current users.

Remaining risk: `spiritkins-app/app.js` is still large and full-root rendering remains the highest frontend regression risk. Do not refactor it during initial Runway provider wiring; add browser smoke coverage first.

## Remaining Blockers

These should block production Runway execution, not Runway planning:

1. No completed Runway provider smoke test against the real account/API.
2. No admin review gate has been proven end-to-end for generated video approval and manifest promotion.
3. Generated video storage is currently local-runtime oriented; production needs durable object storage or a deployment-safe asset promotion path.
4. Index/constraint verification remains unverified through the current schema diagnostic.
5. Production admin/CORS/auth environment has not been verified in this phase.
6. Browser/mobile smoke tests are still absent from the root validation command.
7. Privacy/consent copy for generated media, microphone, transcripts, memory, and retention still needs product review.

## Remaining Risks

- Runway cost exposure if execution is made public or retried automatically.
- Identity drift in generated videos if source assets and prompt packages are not locked per Spiritkin.
- Stale media if generated outputs are attached without manifest versioning and cache-busting.
- User-created Spiritkin media may require separate entitlement and consent rules from canonical Spiritkin media.
- Provider API shape may differ from the current generic Runway provider assumptions and should be validated in a small operator-only spike.
- Full-root frontend rerenders can still interrupt media playback or game surfaces under stress.

## Recommended Runway Integration Sequence

1. **Provider contract spike**
   - Verify current Runway API endpoints, headers, task creation payload, status response, artifact response, timeout behavior, and error shape.
   - Keep this operator/admin-only.

2. **Admin-only queued execution**
   - Use existing generator job routes and provider stack.
   - Require admin auth.
   - Do not expose public user-triggered video generation.

3. **Job lifecycle hardening**
   - Add or confirm states: `drafted`, `queued`, `processing`, `completed`, `failed`, `pending_review`, `approved`, `rejected`, `attached`.
   - Ensure retries are explicit and capped.
   - Persist provider task IDs, attempt count, error code, output metadata, and prompt package.

4. **Artifact storage and review**
   - Download artifacts into the generated asset structure.
   - Keep outputs pending review until approved.
   - Only approved outputs may attach to runtime media slots.

5. **Manifest promotion**
   - Promote approved artifacts into the Spiritkin media manifest or a generated overlay manifest.
   - Keep unavailable slots falling back to still images.
   - Add asset existence diagnostics for promoted outputs.

6. **Closed beta media rollout**
   - Start with canonical trailer videos only.
   - Then add idle/calm loops.
   - Defer speaking videos until voice/video sync policy is clearer.

## Required Environment Variables

Required baseline runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_AUTH_MODE=enforce` for production
- `ADMIN_API_KEY`
- `CORS_ORIGIN` with explicit production origin(s)
- `ADAPTER_MODE`
- `OPENAI_API_KEY` if OpenAI interaction, TTS, or prompt support is expected

Runway-specific:

- `RUNWAY_API_KEY`
- `RUNWAY_API_URL` default exists as `https://api.dev.runwayml.com`
- `RUNWAY_API_VERSION` default exists as `2024-11-06`
- `RUNWAY_MODEL` default exists as `gen3a_turbo`
- `RUNWAY_GENERATE_PATH` default exists as `/v1/video/generate`
- `RUNWAY_EXTEND_PATH` default exists as `/v1/video/extend`
- `RUNWAY_STATUS_PATH` default exists as `/v1/tasks`
- `RUNWAY_POLL_INTERVAL_MS`
- `RUNWAY_POLL_TIMEOUT_MS`
- `RUNWAY_TIMEOUT_MS`

Recommended before production execution:

- provider-specific rate/cost caps
- durable asset storage configuration
- deployment-specific public asset base URL
- operator audit log retention settings

## Recommended Media Job Lifecycle

1. Create job from an approved Spiritkin identity and target slot.
2. Validate owner type, Spiritkin key, media slot, duration, aspect ratio, source assets, and entitlement gate.
3. Generate a locked prompt package and negative prompt package.
4. Save job as `drafted` with `pending_review` output placeholder.
5. Admin explicitly executes the job.
6. Provider task is submitted and task ID is persisted.
7. Poll status with bounded timeout and interval.
8. Download artifact and metadata.
9. Save output as `pending_review`.
10. Admin reviews for identity, safety, quality, and slot fit.
11. Approved outputs attach to runtime manifest slots.
12. Rejected outputs remain archived and unavailable.
13. Failed jobs preserve sanitized error detail and require explicit retry.

## Recommended Asset Naming / Storage Structure

Use the existing generated asset convention as the base:

```text
runtime_data/generated-spiritkins/
  canonical/
    {spiritkin-key}/
      drafts/video/{slot-name}/{version-tag}/
      approved/video/{slot-name}/{version-tag}/
      rejected/video/{slot-name}/{version-tag}/
  user-created/
    {owner-or-spiritkin-key}/
      drafts/video/{slot-name}/{version-tag}/
      approved/video/{slot-name}/{version-tag}/
      rejected/video/{slot-name}/{version-tag}/
```

Each output directory should contain:

- `artifact.mp4`
- `metadata.json`
- optional `thumbnail.png`
- optional `source-assets.json`
- optional `review.json`

Recommended slot names:

- `trailerVideo`
- `idleVideo`
- `speakingVideo`
- `calmVideo`

Production should eventually mirror approved artifacts to durable storage and serve them through stable public paths, while keeping local `runtime_data` as a development/runtime cache rather than the source of truth.

## Rollback Plan If Runway Fails

1. Remove or unset `RUNWAY_API_KEY`.
2. Leave generated video execution admin-only and provider-unavailable.
3. Keep media manifest video slots unavailable or restore previous approved paths.
4. Continue using still-image fallbacks.
5. Mark failed jobs as `failed` or `awaiting_provider`; do not auto-retry.
6. Disable public attachment of generated outputs.
7. Revert the Runway integration commit only if route behavior or diagnostics regress.
8. Run `npm test` before redeploying rollback.

## What Should Still Be Deferred

- Public user-triggered Runway generation.
- Speaking-video lip sync or real-time voice/video sync.
- Native/background wake mode.
- Broad frontend render refactor.
- Database schema migrations as part of Runway wiring.
- Premium game video polish.
- Full public beta launch.
- Compliance-grade data export/delete and retention controls.

## Validation Result

Command: `npm test`

- First sandbox run reached endpoint diagnostics and failed with `spawn EPERM` while trying to spawn the local server.
- Rerun with approved escalation passed.
- Endpoint diagnostics: 34 passed, 0 skipped, 0 failed.
- Schema diagnostics: passed.
- Table checks: 10 passed, 0 failed.
- Column-group checks: 5 passed, 0 failed.
- Index checks: 0 verified, 2 unverified, 0 failed.

## Recommended Next Phase

**Phase A7: Runway Provider Contract And Admin-Only Dry Run Plan**

Goal: verify real Runway API compatibility and wire the smallest admin-only execution path without changing frontend behavior or enabling public generation.

Acceptance criteria:

- provider status reports Runway configured/unconfigured cleanly
- one admin-created video job can be submitted in a non-production or operator-only environment
- provider task ID, sanitized errors, attempt count, and artifact metadata are persisted
- no generated output attaches to a live Spiritkin slot without explicit review
- `npm test` remains green
