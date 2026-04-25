# Legacy Route Control Report

## Routes Found

### `/runtime/*`

- `POST /runtime/interaction/:userId`
  - Live legacy interaction path.
  - Uses the legacy runtime event bus and can bypass the `/v1/interact` orchestrator authority path.
  - Not referenced by the frontend.
- `POST /runtime/spirit/:userId`
  - Live legacy spirit creation shim.
  - Bypasses current identity/session authority.
  - Not referenced by the frontend.
- `POST /runtime/conversation/bootstrap`
  - Live compatibility context bootstrap.
  - Reads legacy runtime context by conversation.
  - Used by endpoint diagnostics only.
- `GET /runtime/context/:conversation_id`
  - Live compatibility context lookup.
  - Reads runtime context directly.
  - Used by endpoint diagnostics only.
- `GET /runtime/episodes/:conversation_id`
  - Live compatibility episode lookup.
  - Reads episode data directly.
  - Used by endpoint diagnostics only.

### `/v0/*`

- `POST /v0/message`
  - Live legacy message generation path.
  - Uses legacy adapters directly and bypasses `/v1/interact`, orchestrator, identityGovernor, safetyGovernor, and session control.
  - Not referenced by the frontend.
- `GET /v0/health`
  - Live legacy health/database ping.
  - Does not invoke intelligence, but remains a legacy surface.
  - Used by endpoint diagnostics only.
- `POST /v0/conversations`
  - Live legacy conversation creation path.
  - Bypasses current v1 conversation/session flow.
  - Not referenced by the frontend.
- `GET /v0/world_state/:conversation_id`
  - Live legacy world state read path.
  - Bypasses v1 session control.
  - Not referenced by the frontend.
- `POST /v0/world_state/:conversation_id`
  - Live legacy world state write path.
  - Bypasses v1 session control.
  - Not referenced by the frontend.
- `GET /v0/memory/list/:conversation_id`
  - Live legacy memory read path.
  - Bypasses current memory/context service flow.
  - Not referenced by the frontend.
- `POST /v0/memory/pin`
  - Live legacy memory mutation path.
  - Bypasses current governed interaction flow.
  - Not referenced by the frontend.

## Routes Gated

All `/runtime/*` and `/v0/*` routes listed above now use the same `legacyRouteGate` Fastify pre-handler.

## Env Var

- `ENABLE_LEGACY_ROUTES=true`

## Production Behavior

- When `NODE_ENV=production` and `ENABLE_LEGACY_ROUTES` is not true, legacy routes return `410 Gone`.
- The response includes `LEGACY_ROUTE_DISABLED` and points callers to the v1 SpiritCore authority routes.
- Blocked production attempts are warning-logged.

## Local and Compatibility Behavior

- In non-production environments, legacy routes remain available for diagnostics and backward compatibility.
- Every allowed legacy route use is warning-logged because these routes may bypass the main v1 authority surface.
- Endpoint diagnostics continue to pass in local mode.
- Endpoint diagnostics now also pass in production mode by expecting `410` for gated legacy checks.

## Frontend Dependency

- A repo search found no current frontend dependency on `/runtime/*` or `/v0/*`.
- Current frontend interaction paths use `/v1/interact`, `/v1/session/*`, and other v1 routes.

## Validation

- Initial `npm test` in the sandbox hit `spawn EPERM` when endpoint diagnostics attempted to spawn the local server.
- Rerun with approved escalation passed: 31 passed, 0 skipped, 0 failed.
- Production-mode endpoint diagnostics also passed: 31 passed, 0 skipped, 0 failed, with legacy route checks accepted as gated `410` responses.
