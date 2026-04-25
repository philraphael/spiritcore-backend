# Runway Execution Spike Report

Date: 2026-04-25

Scope: Phase A9 admin-only Runway execution spike gate. This is not production generation, not user-facing generation, and not asset promotion.

## Hard Safety Gates

Real external Runway execution can occur only when every gate passes:

- `NODE_ENV !== "production"`
- `ADMIN_AUTH_MODE=enforce` or the admin guard is active with a real credential
- `RUNWAY_API_KEY` exists
- `RUNWAY_DRY_RUN_EXECUTE=true`
- `RUNWAY_ALLOW_PROVIDER_EXECUTION=true`
- `assetKind` is `realm_background` or `portrait`
- `safetyLevel` is `internal_review`
- `targetId` is a non-production test target such as `test-realm` or `test-spiritkin`

If any gate is missing, the route returns a dry-run execution spike response with `externalApiCall: false`.

## Route Behavior

Added admin-only routes:

- `POST /admin/runway/execution-spike`
- `POST /v1/admin/runway/execution-spike`

The route:

- requires the existing admin auth guard
- validates the same core Runway request fields as the dry-run route
- builds a normalized job request
- builds a provider payload preview
- returns missing safety gates when execution is disabled
- calls the provider only through `submitRunwayJob(job)` if all gates pass
- never writes generated assets
- never promotes assets
- never updates manifests
- never exposes secrets

Default behavior is dry-run/no-cost.

## Provider Functions Added

Extended `src/services/runwayProvider.mjs` with:

- `canExecuteRunwayProvider(config, env, authContext)`
- `buildRunwayApiPayload(job)`
- `submitRunwayJob(job)`
- `normalizeRunwayResponse(response)`
- `pollRunwayJobStatus(providerJobId)`
- `createExecutionSpikeJob(input, context)`

`submitRunwayJob(job)` is the only function that performs a real external provider call.

## Payload Shape

The spike payload preview contains:

```json
{
  "model": "gen3a_turbo",
  "promptText": "...",
  "negativePromptText": "...",
  "ratio": "16:9",
  "duration": 8,
  "metadata": {
    "spike": true,
    "targetType": "realm",
    "targetId": "test-realm",
    "assetKind": "realm_background",
    "safetyLevel": "internal_review",
    "requestedBy": "x-admin-key"
  }
}
```

The actual provider endpoint and model are read from existing Runway config:

- `RUNWAY_API_URL`
- `RUNWAY_API_VERSION`
- `RUNWAY_MODEL`
- `RUNWAY_GENERATE_PATH`

## Response Normalization

Provider responses are normalized to:

- `provider`
- `providerJobId`
- `status`
- `rawStatus`
- `responseKeys`
- `submittedAt`

Raw provider payloads and secrets are not returned.

## Execution Disabled By Default

Endpoint diagnostics explicitly starts the server with:

- `RUNWAY_DRY_RUN_EXECUTE=false`
- `RUNWAY_ALLOW_PROVIDER_EXECUTION=false`
- `RUNWAY_API_KEY=""`

So diagnostics cannot accidentally call Runway.

## Exact Steps For One Real Test Later

Only run this in a non-production environment:

1. Set `NODE_ENV` to a non-production value.
2. Set `ADMIN_AUTH_MODE=enforce`.
3. Set `ADMIN_API_KEY`.
4. Set `RUNWAY_API_KEY`.
5. Set `RUNWAY_DRY_RUN_EXECUTE=true`.
6. Set `RUNWAY_ALLOW_PROVIDER_EXECUTION=true`.
7. Call `POST /admin/runway/execution-spike` with admin auth.
8. Use exactly one internal test target:

```json
{
  "targetId": "test-realm",
  "assetKind": "realm_background",
  "promptIntent": "Create one internal review realm background test for provider payload verification only.",
  "styleProfile": "spiritverse_internal_test",
  "safetyLevel": "internal_review",
  "durationSec": 8,
  "aspectRatio": "16:9"
}
```

9. Record the normalized provider job id/status.
10. Do not download, promote, or attach the output in this phase.
11. Turn both execution flags back off.

## Rollback / No-Promotion Guarantee

A9 does not write assets, update manifests, create database records, or promote outputs. Rollback is disabling:

- `RUNWAY_DRY_RUN_EXECUTE`
- `RUNWAY_ALLOW_PROVIDER_EXECUTION`
- `RUNWAY_API_KEY`

With any one of those missing, the route returns dry-run only.

## Remaining Risks

- Runway API payload shape may need adjustment after the first real provider response.
- A successful provider task may still create provider-side cost.
- No artifact download or status polling is finalized yet.
- No generated output should be used by the app until the A8 review/promotion pipeline is implemented with actual file operations and operator approval.
- Public beta still needs environment verification and privacy/product review before generated media is exposed.

## Diagnostics Result

Endpoint diagnostics now verifies:

- unauthenticated execution spike route is blocked
- authenticated malformed execution spike request is rejected
- authenticated valid execution spike request without execution flags returns `externalApiCall: false`

Latest validation result:

- Initial sandbox `npm test` reached endpoint diagnostics and failed with known `spawn EPERM`.
- Elevated `npm test` passed.
- Endpoint diagnostics: 43 passed, 0 skipped, 0 failed.
- Schema diagnostics: passed.
- No external Runway API call was made.
