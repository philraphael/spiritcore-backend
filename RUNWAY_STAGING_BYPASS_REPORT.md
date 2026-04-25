# Runway Staging Bypass Report

## Purpose

This phase adds a temporary, route-local staging bypass for exactly the Runway A10 execution spike route:

- `POST /admin/runway/execution-spike`
- `POST /v1/admin/runway/execution-spike`

The bypass exists only to avoid the current Railway staging admin-key mismatch while preserving all Runway execution safety gates.

## Bypass Scope

The bypass is not global admin auth. It is implemented only as the pre-handler for the execution-spike routes listed above.

The bypass is allowed only when all of the following are true:

- `NODE_ENV=staging`
- `RUNWAY_STAGING_TEST_BYPASS=true`
- `targetId` starts with `test-`
- `assetKind` is `realm_background` or `portrait`
- `safetyLevel` is `internal_review`

If any condition fails, the route falls back to normal `requireAdminAccess`.

## Provider Execution Gates

Reaching the route does not mean Runway executes. Real provider execution still requires:

- `NODE_ENV=staging`
- `RUNWAY_API_KEY` present
- `RUNWAY_DRY_RUN_EXECUTE=true`
- `RUNWAY_ALLOW_PROVIDER_EXECUTION=true`
- `ADMIN_AUTH_MODE=enforce` or a real active admin guard
- `targetId` test-only
- `assetKind` limited to `realm_background` or `portrait`
- `safetyLevel=internal_review`

If any gate is missing, the response remains a dry-run style execution-gate response with `externalApiCall: false`.

## Safe Logging

The execution-spike route logs only:

- `stagingBypassUsed`
- `targetId`
- `assetKind`
- `safetyLevel`
- `externalApiCall`

No secrets, admin tokens, request header values, or Runway API keys are logged.

## No Promotion Guarantees

This change does not:

- add frontend controls
- write generated assets
- update manifests
- promote to `ACTIVE`
- auto-approve generated assets
- alter the generated asset promotion pipeline

## Diagnostics

Endpoint diagnostics now verify:

- production does not allow the staging bypass
- malformed staging bypass input is rejected
- a valid staging test request can reach the execution gate
- provider execution remains disabled in diagnostics
- promotion planning still requires operator approval and does not update manifests

## Staging Configuration

Set only on Railway staging:

```text
NODE_ENV=staging
RUNWAY_STAGING_TEST_BYPASS=true
```

Do not set `RUNWAY_STAGING_TEST_BYPASS` in production.

For a real A10 provider test, staging must also explicitly set:

```text
RUNWAY_API_KEY=<secret>
RUNWAY_DRY_RUN_EXECUTE=true
RUNWAY_ALLOW_PROVIDER_EXECUTION=true
ADMIN_AUTH_MODE=enforce
```

Secrets must remain in Railway environment variables only.
