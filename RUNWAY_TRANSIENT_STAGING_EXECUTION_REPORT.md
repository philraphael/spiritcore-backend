# Runway Transient Staging Execution Report

## Purpose

This phase adds a temporary request-scoped credential path for the Runway execution spike route so one A10 staging test can run when Railway staging environment variable injection is blocked.

The path is limited to:

- `POST /admin/runway/execution-spike`
- `POST /v1/admin/runway/execution-spike`

This phase also adds a staging-only non-generation auth check route:

- `POST /admin/runway/auth-check`

## Temporary Headers

The route recognizes these headers only for a qualifying staging test request:

- `x-runway-transient-key`
- `x-spiritcore-runway-token`
- `x-spiritcore-transient-key`
- `x-runway-transient-execute`
- `x-runway-transient-provider-execution`

The key is read from the first non-empty value in that order.

If staging infrastructure strips custom key headers, the route also accepts `body.runwayTransientKey` after the same staging/test gates pass. This body fallback is not accepted in production or for non-test targets.

`body.runwayTransientKey` is included only in the execution-spike route schema. It is not part of the dry-run schema or other admin route schemas.

The transient key is not logged, stored, persisted, written to files, or copied into global process state. It is used only to build the per-request Runway provider config and env context passed to `createExecutionSpikeJob`.

## Required Gates

The transient path is honored only when all of the following are true:

- `NODE_ENV=staging`
- `RUNWAY_STAGING_TEST_BYPASS=true`
- `targetId` starts with `test-`
- `assetKind` is `realm_background` or `portrait`
- `safetyLevel` is `internal_review`
- one allowed transient key header or `body.runwayTransientKey` is present

Real provider execution still requires:

- `NODE_ENV=staging`
- a Runway API key, either staging env, transient request header, or `body.runwayTransientKey`
- `RUNWAY_DRY_RUN_EXECUTE=true` or `x-runway-transient-execute=true`
- `RUNWAY_ALLOW_PROVIDER_EXECUTION=true` or `x-runway-transient-provider-execution=true`
- `ADMIN_AUTH_MODE=enforce` or the request-scoped staging transient config override
- execution-spike target and safety restrictions

## Safe Logging

The route logs only:

- `stagingBypassUsed`
- `transientKeyProvided`
- `transientKeySource`
- `transientExecuteRequested`
- `transientProviderExecutionRequested`
- `targetId`
- `assetKind`
- `safetyLevel`
- `externalApiCall`

No secrets or request header values are logged.

## No Promotion Guarantees

This phase does not:

- add frontend controls
- expose Runway to users
- write generated assets
- update manifests
- promote to `ACTIVE`
- alter generated asset review or promotion behavior

## Diagnostics

Endpoint diagnostics verify:

- production cannot use the transient header path
- malformed requests cannot use the transient header path
- the alternate transient key header is accepted in the staging mock path
- production cannot use the body fallback
- malformed targets cannot use the body fallback
- `body.runwayTransientKey` is preserved by the execution-spike route schema long enough to reach the execution gate
- a mock body fallback with execution flags would pass gates without calling the provider
- staging valid requests without transient credentials remain dry-run
- staging valid requests with a mock transient key reach the execution gate without calling the provider

Diagnostics do not require or use a real Runway API key.

## Runway Auth Check

`POST /admin/runway/auth-check` accepts only `body.runwayTransientKey` and is available only when:

- `NODE_ENV=staging`
- `RUNWAY_STAGING_TEST_BYPASS=true`

The route calls only `GET /v1/organization` with:

- `Authorization: Bearer <transient key>`
- `X-Runway-Version: 2024-11-06`

It does not call generation endpoints, write assets, update manifests, or promote generated media. Returned fields are sanitized:

- `externalApiCall`
- `authOk`
- `providerStatus`
- `responseKeys`
- `creditBalance` if returned by Runway
- `message` for sanitized failures such as `Runway rejected the API key`

The transient key is not logged, stored, or returned.

## Provider Payload Mapping

SpiritCore now maps Runway generation payloads by media type before any paid execution is allowed.

Image asset kinds use:

- endpoint: `POST /v1/text_to_image`
- model: `gen4_image`
- asset kinds: `portrait`, `hero`, `realm_background`, `game_board_theme`, `game_piece_set`

Video asset kinds use:

- endpoint: `POST /v1/image_to_video`
- model: `gen4_turbo`
- asset kinds: `idle_video`, `speaking_video`, `calm_video`, `trailer`

Image payloads use the current `promptText` and `ratio` shape and do not include the older video-only fields such as `promptImage` or `duration`. Video payloads are reserved for future image-to-video work and include `promptImage` only when a source asset is provided.

Diagnostics verify image and video provider target mapping and build image execution-spike payloads without calling Runway.

## One-Test Operator Procedure

For the real A10 test, the operator should paste the Runway key into a secure PowerShell prompt and send it only as an HTTPS request header. The command should not echo the key and should not save it to disk.
