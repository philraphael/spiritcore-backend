# SpiritCore Full System Inventory and Media Alignment Report

Date: 2026-04-26

## Executive summary

This phase performed a read-only inventory of the SpiritCore backend and media pipeline. No media generation, provider call, promotion, manifest update, ACTIVE write, schema change, or production behavior change was performed.

The project is organized around a single Fastify server (`server.mjs`), a dependency-injected core container (`src/container.mjs`), domain route modules (`src/routes/*`), and service modules (`src/services/*`). The authoritative conversation path remains the SpiritCore orchestrator. The controlled media path is now centered on the newer media services and admin media routes:

- `src/services/spiritCoreMediaProduction.mjs`
- `src/services/runwayProvider.mjs`
- `src/services/mediaAssetIngestService.mjs`
- `src/services/sourceStillIngestService.mjs`
- `src/services/generatedAssetPipeline.mjs`
- `src/routes/admin.mjs`

The largest alignment risk is that older generator job routes and services still exist beside the newer controlled media pipeline. They should be treated as legacy or command-center job foundation until a migration plan explicitly routes them through the newer media production, provider, review, and ingest services.

## Current systems found

| System | Primary files | Current role | Reuse direction |
|---|---|---|---|
| Server/bootstrap | `server.mjs`, `src/config.mjs`, `src/container.mjs` | Fastify startup, route registration, static app assets, legacy route gate, `/v1/speech`, generator shortcut | Keep as the composition root. Add new behavior through route modules/services. |
| SpiritCore orchestrator | `src/services/orchestrator.mjs`, `src/routes/interact.mjs` | Main intelligence pipeline for `/v1/interact` | All user-facing intelligence should remain behind this path. Media generation should not bypass it for companion canon. |
| Identity governance | `src/services/identityGovernor.mjs`, `src/models/spiritkinIdentity.mjs`, `src/services/spiritkinRegistry.mjs` | Resolves and validates canonical Spiritkin identity; checks response drift | Media prompts should reuse identity descriptors and drift rules before provider execution. |
| Safety governance | `src/services/safetyGovernor.mjs`, `src/services/safetyClassifier.mjs` | Deterministic input/output safety pass and `safety_events` logging | User-created/premium generation prompts must pass through this layer before generation is enabled. |
| Memory stack | `memory.mjs`, `hierarchicalMemory.mjs`, `structuredMemoryService.mjs`, `spiritMemoryEngine.mjs`, `memoryExtractor.mjs` | Conversation continuity, structured facts, memories, memory brief | Do not write raw generation attempts into memory. Approved assets may later create structured continuity events. |
| Emotion/session/world | `emotionService.mjs`, `episodeService.mjs`, `world.mjs`, `worldProgression.mjs`, `sessionControlService.mjs` | Emotion state, episodes, world/scene state, startup/session control | Runtime media selection should eventually map approved motion assets to emotion/session state. |
| Speech/TTS | `server.mjs`, `src/adapters/openai.shared.mjs`, `src/middleware/rateLimiter.mjs` | `/v1/speech` validation and TTS provider call | Keep audio independent from Runway clips. Runway motion clips should stay silent. |
| Spiritkins registry/API | `src/routes/spiritkins.mjs`, `src/services/spiritkinRegistry.mjs` | Canonical Spiritkin listing and lookup | Source still and motion pack planning should use canonical IDs here. |
| Games/events/quests | `games.mjs`, `sharedGameEngine.mjs`, `gameEngine.mjs`, `spiritverseEvents.mjs`, `dailyQuestService.mjs` | Spiritverse games, events, quests, journal hooks | Game media themes should use media planning routes, not separate provider calls. |
| Command center/admin | `src/routes/admin.mjs`, `server.mjs` command-center static routes | Admin inspection, generator foundations, Runway/media operator routes | Command center UI should call backend media services, not duplicate provider or file path logic. |
| Runway provider | `src/services/runwayProvider.mjs` | Dry-run, auth check, execution gates, payload mapping, task status | Single provider boundary for Runway. Keep provider calls isolated here. |
| Media production | `src/services/spiritCoreMediaProduction.mjs` | Domain model, requirement profiles, templates, plans, motion states, sequence composition, SpiritGate planning | Treat as the canonical media planning service. |
| Asset ingest | `mediaAssetIngestService.mjs`, `sourceStillIngestService.mjs` | Approved output ingest and canonical source still ingest | Use for filesystem writes. Promotion/ACTIVE must remain separate. |
| Diagnostics | `scripts/endpoint-diagnostics.mjs`, `scripts/schema-verify.mjs`, package scripts | Syntax, endpoint, route safety, schema verification | Continue expanding diagnostics before each generation phase. |
| Issue/repair foundation | `issueReportService.mjs`, admin issue routes | Issue reports, digests, repair packets/handoff | Can later track failed media jobs and stuck review states; should not auto-promote. |

## Route inventory

### Public app and static routes

| Route group | Purpose | Auth | Writes/generates/promotes/ACTIVE |
|---|---|---|---|
| `GET /`, `/app`, `/app/:asset`, `/app/data/:asset` | Serve main app and app assets | Public | Read-only static serving |
| `GET /operator`, `/operator/:asset` | Serve operator UI assets | Admin | Read-only static serving |
| `GET /command-center`, `/command-center.js`, `/command-center.css` | Serve command center | Admin | Read-only static serving |
| `GET /app/active-assets/*`, `/app/assets/*`, `/app/spiritkin-videos/*`, `/app/game-theme-assets/*`, `/app/game-concept-assets/*`, `/app/premium-game-assets/*` | Serve public app/media asset directories | Public | Read-only static serving |
| `GET /generated-spiritkins/*`, `/portraits/:filename`, `/videos/:filename`, `/world-art/:filename` | Serve generated/canonical media | Public | Read-only static serving |

### Health and diagnostics routes

| Route | Purpose | Auth | Safety |
|---|---|---|---|
| `GET /health` | Liveness | Public | Read-only |
| `GET /ready` | Readiness/config state | Public | Read-only |
| `GET /metrics` | Runtime metrics | Admin | Read-only |
| `GET /v0/health` | Legacy health | Legacy gate | Disabled in production unless `ENABLE_LEGACY_ROUTES=true` |

### Core user and conversation routes

| Route group | Purpose | Auth | Writes/generates/promotes/ACTIVE |
|---|---|---|---|
| `POST /v1/interact` | Main SpiritCore interaction/orchestrator path | Public/API client | Writes messages, memory/world/emotion/episodes through orchestrator; no media generation |
| `POST /v1/conversations`, `GET /v1/conversations/:userId` | Conversation create/list | Public/API client | Conversation persistence |
| `GET /v1/session/snapshot`, `POST /v1/session/control` | Session/wake/startup state | Public/API client | Session/conversation/message/world writes |
| `GET /v1/memory/:conversationId`, `GET /v1/memory/list/:conversationId` | Memory reads | Public/API client | Read-only |
| `GET /v1/world/:conversationId`, `POST /v1/world/:conversationId` | World state read/write | Public/API client | World state writes; no media generation |
| `POST /v1/speech` | TTS speech synthesis | Public/API client with rate limit | Provider call to TTS only; no media writes |

### Spiritkin, SpiritCore, games, events, and support routes

| Route group | Purpose | Auth | Writes/generates/promotes/ACTIVE |
|---|---|---|---|
| `GET /v1/spiritkins`, `GET /v1/spiritkins/:name` | Canonical Spiritkin listing/detail | Public | Read-only |
| `POST /v1/spiritcore/welcome` | Default SpiritCore welcome/startup response | Public/API client | May create session context; no media generation |
| `GET /v1/bond-journal` | Bond journal data | Public/API client | Read-only/derived |
| `GET /v1/quests/daily`, `/v1/quests/daily/next` | Daily quest data | Public/API client | Read-only/derived |
| `GET /v1/spiritverse/events/current`, `/all` | Spiritverse event info | Public | Read-only |
| `GET /v1/games/list`, `POST /v1/games/start`, `/move`, `/draw`, `/end`, `GET /v1/games/state/:conversationId` | Game lifecycle | Public/API client | Game/world/message writes; no media generation |
| `POST /v1/feedback`, `POST /v1/analytics/event`, `POST /v1/issues/report` | Feedback, analytics, issue reports | Public/API client | Writes analytics/issues |
| `GET /questions`, `POST /calculate` | Veil crossing flow | Public | Read-only/calculation |
| `GET /v1/entitlements/:userId` | Entitlement check | Public/API client | Read-only |

### Legacy compatibility routes

| Route group | Purpose | Auth/safety | Notes |
|---|---|---|---|
| `/runtime/interaction/:userId`, `/runtime/spirit/:userId`, `/runtime/conversation/bootstrap`, `/runtime/context/:conversation_id`, `/runtime/episodes/:conversation_id` | Earlier runtime compatibility paths | `legacyRouteGate` | Production returns gated response unless `ENABLE_LEGACY_ROUTES=true`. These can bypass newer `/v1/interact` patterns if re-enabled. |
| `/v0/message`, `/v0/conversations`, `/v0/world_state/:conversation_id`, `/v0/memory/list/:conversation_id`, `/v0/memory/pin` | v0 compatibility paths | `legacyRouteGate` | Keep disabled in production except explicit compatibility windows. |

### Admin, Runway, and media routes

| Route group | Purpose | Auth/safety | Writes/generates/promotes/ACTIVE |
|---|---|---|---|
| `/v1/admin/conversations/*`, `/v1/admin/stats`, `/v1/admin/issues/*`, `/v1/analytics/*` admin reads | Operator/admin inspection | Admin | Mostly read-only, issue repair packet generation is reporting only |
| `/admin/runway/dry-run`, `/v1/admin/runway/dry-run` | Request validation and prompt/path planning | Admin | No provider call by default |
| `/admin/runway/auth-check` | Staging-only organization auth check | Staging + bypass/key | Calls Runway organization endpoint only; no generation |
| `/admin/runway/execution-spike`, `/v1/admin/runway/execution-spike` | One controlled execution spike | Admin/staging gates/transient key | Provider generation only if all hard gates pass; no promotion/manifest/ACTIVE |
| `/admin/runway/status-check` | Staging task status check | Staging + key | Provider status read only |
| `/admin/media/*-plan`, `/admin/media/catalog-summary`, `/admin/media/requirements-check`, `/admin/media/generation-template`, `/admin/media/review-plan`, `/admin/media/promotion-plan` | Media planning and review/promotion plans | Admin or staging planning bypass for approved planning routes | No provider call, no writes, no ACTIVE |
| `/admin/media/source-reference-plan`, `/source-reference-registry-plan`, `/spiritkin-source-reference-plan`, `/spiritkin-source-summary/:spiritkinId` | Source reference planning/discovery | Admin/planning bypass | Read-only/no provider |
| `/admin/media/spiritgate-enhancement-execute` | Staging SpiritGate provider execution | Staging/operator/transient gates | Provider call only under gates; review_required only; no promotion/manifest/ACTIVE |
| `/admin/media/spiritkin-motion-state-execute` | Staging Spiritkin motion generation | Staging/operator/transient gates | Provider call only under gates; review_required only; no promotion/manifest/ACTIVE |
| `/admin/media/asset-ingest` | Approved reviewed provider output ingest | Admin or narrow staging ingest bypass | Writes APPROVED and optional ARCHIVE; no ACTIVE/manifest/promotion |
| `/admin/media/source-still-ingest` | Approved canonical source still ingest | Admin or narrow staging ingest bypass | Writes APPROVED source still and optional ARCHIVE; no ACTIVE/manifest/promotion |
| `/admin/media/assembly-plan`, `/assemble-video`, `/sequence-compose-plan`, `/sequence-compose-execute` | Assembly and sequence composition planning/foundation | Admin/planning bypass when planned-only | Current diagnostics enforce no ACTIVE/manifest/provider; execution route remains safe/planned unless tooling is explicitly safe |
| `/admin/generated-assets/promotion-plan`, `/v1/admin/generated-assets/promotion-plan` | Generated asset promotion planning | Admin | Plan only; no file write |
| `/v1/admin/generator/image`, `/video`, `/jobs/:jobId/execute`, `/jobs/:jobId/retry`, `/review` | Older generator command-center foundation | Admin | Stores runtime job specs/outputs under `runtime_data`; overlaps with newer media pipeline and should be migrated carefully |

## Service and module inventory

| Service/module | Purpose | Key exports | Route/users | Overlap/reuse notes |
|---|---|---|---|---|
| `orchestrator.mjs` | 12-stage conversation pipeline | `createOrchestrator` | `/v1/interact`, games | Authoritative user intelligence path. Do not bypass with media features. |
| `identityGovernor.mjs` | Identity resolve/validate/drift | `createIdentityGovernor` | Orchestrator | Must feed media prompt canon descriptors in future. |
| `safetyGovernor.mjs`, `safetyClassifier.mjs` | Safety pre/post pass, safety event logging | `createSafetyGovernor`, classifiers | Orchestrator | User-created generation prompts should reuse this before provider calls. |
| `spiritkinRegistry.mjs`, `spiritkinIdentity.mjs` | Canonical Spiritkin data and validation | `createSpiritkinRegistry`, identity helpers | Spiritkin routes, identity governor | Source/motion routes should resolve known Spiritkins here. |
| `conversationService.mjs`, `messageService.mjs` | Conversation/message persistence | create factories | Conversation/session/orchestrator | Media failures should not become chat messages by default. |
| `contextService.mjs` | Assembles memory/emotion/world context | `createContextService` | Orchestrator | Later runtime media selection can consume context outputs. |
| `memory.mjs`, `memoryExtractor.mjs`, `hierarchicalMemory.mjs`, `structuredMemoryService.mjs`, `spiritMemoryEngine.mjs` | Memory layers | create factories and extract/rank helpers | Orchestrator/context/games | Approved media milestones can be written after review; raw attempts should not. |
| `emotionService.mjs`, `episodeService.mjs`, `engagementEngine.mjs`, `adaptiveProfileService.mjs`, `spiritCoreAdaptiveService.mjs` | Emotion, episode, engagement, adaptation | create factories | Orchestrator/session | Motion selection should map to emotion/session state, not provider generation. |
| `world.mjs`, `worldProgression.mjs`, `spiritverseEvents.mjs` | World/scene/event progression | create factories/event helpers | World routes, games, context | Realm/source references should reuse canonical world state. |
| `responseEngine.mjs`, `guidanceService.mjs` | Response shaping/guidance | create factories | Orchestrator | Useful for prompt tone/canon guidance, not provider IO. |
| `openai.shared.mjs`, `openaiAdapter.mjs`, `localAdapter.mjs`, `templateAdapter.mjs` | Language/TTS adapters | response/TTS helpers | Orchestrator, `/v1/speech` | TTS must remain separate from silent motion clips. |
| `runwayProvider.mjs` | Runway contract, payloads, auth, task status | prompt, validate, payload, submit, status helpers | Admin Runway/media execution routes | Canonical provider boundary for Runway. |
| `spiritCoreMediaProduction.mjs` | Media domain model, requirements, templates, source refs, motion plans, sequence plans, SpiritGate plans | many media planning helpers | `/admin/media/*` | Canonical media planning/service layer. |
| `mediaAssetIngestService.mjs` | Approved output ingest to APPROVED/ARCHIVE | build/validate/ingest | `/admin/media/asset-ingest` | Complements source still ingest; no ACTIVE. |
| `sourceStillIngestService.mjs` | Canonical source still ingest to APPROVED/ARCHIVE | build/validate/ingest | `/admin/media/source-still-ingest` | Complements source reference planning; no ACTIVE. |
| `generatedAssetPipeline.mjs` | Generated asset lifecycle path planning | build/validate/path/promotion plan | `/admin/generated-assets/promotion-plan` | May be folded into media promotion route later. |
| `spiritkinGeneratorService.mjs`, `spiritkinGeneratorProviderStack.mjs` | Older generator jobs/provider stack | `createSpiritkinGeneratorService`, provider stack | `/v1/admin/generator/*`, `/v1/spiritkin/generate` | Main duplication risk with newer media pipeline. Keep until migrated. |
| `gameEngine.mjs`, `sharedGameEngine.mjs`, `dailyQuestService.mjs` | Games and quests | create helpers | Games/quest routes | Game media should consume approved assets only. |
| `issueReportService.mjs`, `feedbackService.mjs`, `analyticsService.mjs` | Issues/feedback/analytics | create factories | Admin/issues/analytics | Good target for media failure reporting. |
| `entitlements.mjs` | Entitlement checks | `createEntitlementsService` | Orchestrator, entitlements routes | Premium generation must check this before enabling user-facing generation. |

## Diagnostics inventory

| Diagnostic | Command | Protects | Current coverage |
|---|---|---|---|
| Syntax checks | `node --check server.mjs`, app JS, games JS | Parse regressions in server/app/game files | Root `npm test` runs these |
| Endpoint diagnostics | `node scripts/endpoint-diagnostics.mjs` | Route availability, safety gates, media no-write flags, provider payload shaping, staging bypass denial, source/asset paths | Strong media/Runway/admin coverage; also health/session/legacy/app/static coverage |
| Schema verification | `node scripts/schema-verify.mjs` | Required Supabase tables/columns/index expectations | Read-only; indexes may be unverified if `pg_catalog.pg_indexes` is not exposed |
| Health checks | `/health`, `/ready`, `/metrics` | Runtime liveness/readiness/metrics | Covered by endpoint diagnostics |
| Legacy gate checks | endpoint diagnostics | Production-safe legacy behavior | Verifies disabled/gated behavior |
| Media provider safety | endpoint diagnostics | No generation in planning routes, transient staging gates, sanitized provider failures | Broad coverage for Runway, SpiritGate, motion state, ingest, source still, sequence plans |
| Gaps to add | future diagnostics | Identity prompt reuse, safetyGovernor prompt moderation, emotion-to-motion runtime selection, command center UI route coverage | Recommended before premium self-generation |

## Existing system alignment

### identityGovernor

Media generation should consume canonical identity descriptors from the identity registry/governor. Prompt construction should preserve name, role, visual identity, tone, forbidden drift patterns, and crisis behavior boundaries. The media pipeline should add an explicit identity-canon section to provider prompts before premium or user-created generation is enabled.

### safetyGovernor

The current safety governor protects conversation input/output. Premium user-created Spiritkin prompts and source descriptions should pass through the same safety layer, with new safety events for generation request rejected, prompt sanitized, provider failure, and review rejection. The safety layer must remain deterministic and must not call media providers.

### Memory and episode systems

Raw generation attempts, provider failures, and rejected artifacts should not pollute user memory. Approved media assets can later create structured continuity events such as "Lyra motion pack v1 approved" or "SpiritGate cinematic upgrade promoted" after operator approval. Premium-user asset creation should write episodes only after review.

### Emotion state system

Emotion labels and session state should eventually select approved runtime assets: calm maps to idle/listen, focused maps to think/listen, joyful maps to greeting/gesture, speaking maps to speaking clips, and wake/session startup maps to greeting_or_entry. Review-required media must never be selected at runtime.

### world_state and Spiritverse scene

World state should drive realm and environment references, avoiding random backgrounds that break canon. Realm backgrounds and environment source stills should be registered as reusable source references before wide/full-body motion generation.

### Speech/TTS

Speech and voice identity remain separate from Runway visual clips. Motion clips should be silent. `/v1/speech` controls audio generation and should later synchronize to approved speaking clips without embedding audio into Runway outputs.

### Wake-up/session flow

Session startup should eventually select approved greeting_or_entry, idle, listen, and speaking assets. It must not depend on unfinished, review_required, or failed media jobs.

### Command center

The command center should show generation state, review state, source readiness, budget state, provider failures, and promotion readiness by calling backend media routes. It should not duplicate provider payload construction, file naming, source category rules, or promotion logic.

### Self-repair/recovery

The issue/repair route foundation exists. A future media recovery checker should detect failed jobs, expired provider output URLs, missing APPROVED files, stuck review states, and bad source category mappings. It should report and propose repair packets, not auto-promote or overwrite assets.

## Duplication and regression audit

1. `spiritkinGeneratorService.mjs` plus `/v1/admin/generator/*` overlaps with the newer `/admin/media/*`, `runwayProvider.mjs`, and ingest services. Risk: command center may create jobs that bypass newer review/source/ACTIVE safeguards.
2. `generatedAssetPipeline.mjs` and media promotion helpers both produce promotion plans. Risk: two promotion-plan formats could diverge. Choose one canonical promotion contract before enabling ACTIVE writes.
3. `mediaAssetIngestService.mjs` and `sourceStillIngestService.mjs` are intentionally separate but should share conventions for date/hash/path metadata. Risk is low; keep separation because one ingests generated outputs and one ingests canonical references.
4. Legacy `/runtime/*` and `/v0/*` routes can bypass current orchestration if explicitly enabled. Keep production gate strict.
5. Staging bypasses exist for Runway tests, media planning, media ingest, and source still ingest. They are route-specific and diagnostics-covered, but every future route must prove production denial.
6. Static serving paths are broad and include generated/public media roots. Avoid writing ACTIVE or public runtime paths from planning or ingest routes.
7. Command center UI still has older generator job concepts. It needs alignment with source still registry, motion-pack planning, approved asset ingest, and sequence composition.

## Recommended media pipeline architecture

1. Canon identity card: resolve canonical Spiritkin identity through registry/governor.
2. Source still pack generation: produce close, medium, full-body, seated, and realm/environment source stills under review.
3. Source still ingest/registry: ingest only approved source stills into APPROVED source_stills and register availability.
4. Motion-pack planning: choose asset types, source categories, prompt modes, shot profiles, completion rules, and budget.
5. Motion generation queue: create review_required jobs only after operator approval and safety checks.
6. Provider execution: call Runway only through `runwayProvider.mjs` with staged gates or future server-side production gates.
7. Status polling: use sanitized status route/helpers; never expose secrets; preserve failure code/message.
8. Review scoring: operator or future automated scorer checks identity, motion completion, background clarity, artifacts, and state fit.
9. Approved asset ingest: ingest reviewed outputs into APPROVED with metadata and optional raw archive.
10. Sequence composition: compose longer premium sequences from approved clips only, still as review candidates.
11. Activation/promotion: update ACTIVE/manifest only through a future explicit promotion route after pack criteria are met.
12. Runtime selection: SpiritCore selects approved ACTIVE assets by session/emotion/speech state.

## Premium user creation readiness map

Premium self-generation is not ready yet. Required before enablement:

- User creation form and canonical prompt builder.
- Safety moderation for names, roles, visual concepts, prompts, and source uploads.
- Account entitlement checks and separable SpiritCore/Spiritkin premium flags.
- Budget/credit controls, retry limits, and per-user queue throttling.
- Server-side provider execution without transient keys.
- Source still starter pack workflow before motion generation.
- Auto-review/scoring support plus required human/admin review mode.
- Storage registry linkage from user account to approved assets.
- Partial pack activation rules and user-facing generation status.
- Failed generation recovery, support/admin review, and refund/credit policy hooks.
- Runtime selection rules that never use review_required or rejected assets.

## Regression guard recommendations

- Every new route should declare whether it reads, writes, calls providers, generates, promotes, or writes ACTIVE.
- Every generation route should prove premium self-generation remains disabled unless explicitly enabled.
- Every asset/source route should prove no ACTIVE write unless the route is a dedicated promotion route.
- Every source/motion route should verify source category mapping and reject missing required references.
- Every Runway route should sanitize provider failures, expose safe provider issue details, and never print secrets.
- Every command center route should call backend service helpers instead of duplicating provider or file naming logic.
- Every production route should deny staging bypass headers in diagnostics.
- Every future promotion route should require pack completeness, explicit operator approval, rollback path, manifest target, and audit metadata.

## Next implementation steps

1. Add a read-only command center catalog endpoint that combines source still readiness, motion-pack readiness, approved assets, failed jobs, and sequence candidates from existing services.
2. Create an identity-canon prompt adapter that converts `identityGovernor`/registry output into media prompt descriptors.
3. Add a safety preflight helper for user-created media prompts using `safetyGovernor`.
4. Migrate or wrap `/v1/admin/generator/*` so command center generation jobs use `spiritCoreMediaProduction.mjs`, `runwayProvider.mjs`, and approved ingest services.
5. Add a media review scoring plan before any ACTIVE promotion route.
6. Only after those guards, implement explicit operator-approved promotion to ACTIVE and manifest update.

## Validation

Validation commands for this phase:

- `npm test`
- `node scripts/endpoint-diagnostics.mjs`

Results are recorded in the commit/final response for this phase.

Executed validation:

- `npm test`: passed.
- `node scripts/endpoint-diagnostics.mjs`: passed with `174` passes, `0` skips, `0` failures.
- Schema verification inside `npm test`: passed in read-only mode with secrets not printed. Index expectations may remain unverified when Supabase does not expose `pg_catalog.pg_indexes`, which is the existing expected limitation.
