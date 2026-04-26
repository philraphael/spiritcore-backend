# SpiritCore Route Authority Map

Date: 2026-04-26

This map defines which route groups are authoritative, legacy, staging-only, or plan-only. It is a regression guard for future work: new behavior should extend the authoritative route group instead of creating a parallel generator or promotion path.

| Route group | Authoritative owner | Current status | Provider call allowed | File writes allowed | ACTIVE writes allowed | Production allowed | Staging-only | Command center should call |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `POST /v1/interact` | `src/services/orchestrator.mjs` | Conversational runtime authority | No | Conversation/memory/world writes through services | No | Yes | No | No |
| `POST /v1/speech` | `server.mjs`, `src/adapters/openai.shared.mjs` | Voice/TTS authority | TTS only | No media writes | No | Yes | No | No |
| `/v1/session/*`, `/v1/spiritcore/welcome` | `sessionControlService.mjs`, `spiritcore.mjs` | Runtime session/wake authority | No | Session/conversation/world writes | No | Yes | No | No |
| `/v1/world/*` | `world.mjs` | World/scene authority | No | World state writes | No | Yes | No | No |
| `/v1/spiritkins*` | `spiritkinRegistry.mjs` | Canonical Spiritkin read authority | No | No | No | Yes | No | Maybe, read-only |
| `/admin/media/*` planning routes | `spiritCoreMediaProduction.mjs` | Authoritative future media pipeline | No | No | No | Yes with admin | No | Yes |
| `/admin/media/spiritkin-motion-state-execute` | `spiritCoreMediaProduction.mjs`, `runwayProvider.mjs` | Staging/operator execution route | Yes, gated Runway only | No direct asset writes | No | No | Yes | Later, operator-only |
| `/admin/media/spiritgate-enhancement-execute` | `spiritCoreMediaProduction.mjs`, `runwayProvider.mjs` | Staging/operator execution route | Yes, gated Runway only | No direct asset writes | No | No | Yes | Later, operator-only |
| `/admin/media/asset-ingest` | `mediaAssetIngestService.mjs` | Approved reviewed asset ingest | No | APPROVED and optional ARCHIVE only | No | Yes with real admin | No | Yes, after review |
| `/admin/media/source-still-ingest` | `sourceStillIngestService.mjs` | Approved canonical source still ingest | No | APPROVED/source_stills and optional ARCHIVE only | No | Yes with real admin | No | Yes, after source review |
| `/admin/media/sequence-compose-plan` | `spiritCoreMediaProduction.mjs` | Approved-clip composition planning | No | No | No | Yes with admin | No | Yes |
| `/admin/media/sequence-compose-execute` | `spiritCoreMediaProduction.mjs` | Planned-only until writer is approved | No | Review-space only after future approval | No | No | Yes | Later |
| `/admin/media/promotion-plan` | `spiritCoreMediaProduction.mjs` | Plan-only promotion helper | No | No today | Future explicit promotion only | No today | No | Yes, plan-only |
| `/admin/generated-assets/promotion-plan` | `generatedAssetPipeline.mjs` | Helper/overlap risk | No | No | No | Yes with admin | No | Only if bridged |
| `/admin/runway/dry-run` | `runwayProvider.mjs` | Provider request planning | No by default | No | No | Yes with admin | No | Yes, operator-only |
| `/admin/runway/auth-check` | `runwayProvider.mjs` | Staging auth check | Organization endpoint only | No | No | No | Yes | Operator-only |
| `/admin/runway/status-check` | `runwayProvider.mjs` | Staging status check | Task status endpoint only | No | No | No | Yes | Operator-only |
| `/admin/runway/execution-spike` | `runwayProvider.mjs` | Staging execution spike | Yes, gated Runway only | No | No | No | Yes | Operator-only |
| `/v1/admin/generator/*` | `spiritkinGeneratorService.mjs` | Legacy/overlap generator foundation | Do not expand | Runtime job-store writes | No | Yes with admin | No | Avoid unless bridged |
| `/v1/spiritkin/generate` | `spiritkinGeneratorService.mjs` | Older generation surface | Do not expand | Runtime job-store writes | No | Needs review | No | No |
| `/runtime/*`, `/v0/*` | `server.mjs` `legacyRouteGate` | Legacy gated compatibility | No new provider calls | Compatibility writes possible | No | Disabled unless `ENABLE_LEGACY_ROUTES=true` | No | No |
| `/health`, `/ready`, `/metrics` | `health.mjs` | Health/metrics | No | No | No | Health/ready yes; metrics admin | No | Read-only |
| Public static routes | `server.mjs` | App/media static serving | No | No | No | Yes | No | No |

## Route authority decisions

- `/admin/media/*` is the authoritative future media pipeline.
- `/admin/runway/*` is the provider check/status/execution safety layer, not a standalone media workflow.
- `/v1/admin/generator/*` is legacy/overlap and must not be expanded unless a bridge explicitly routes it through `/admin/media/*`, `runwayProvider.mjs`, and ingest services.
- `/v1/interact` is the conversational runtime authority.
- `/v1/speech` is the audio/TTS authority.
- `/v1/world/*` and `/v1/session/*` are runtime experience authorities.

## Permanent route rules

- Planning routes must return no provider call, no generation, no promotion, no manifest update, and no ACTIVE write.
- Execution routes must be staging/operator gated until a future approved production phase.
- Ingest routes may write APPROVED/ARCHIVE only.
- No route may write ACTIVE until a dedicated future promotion route is implemented, audited, and diagnostics-covered.
- Staging bypass headers must never authorize production behavior.
