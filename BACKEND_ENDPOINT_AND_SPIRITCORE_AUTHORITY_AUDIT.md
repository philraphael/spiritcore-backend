# Backend Endpoint And SpiritCore Authority Audit

Date: 2026-04-23
Project: `C:\spiritcore-backend`

## 1. Endpoint inventory

### Live shell, static, and operator routes

| Method | Path | Purpose | Expected input | Expected output | Auth/session assumptions | Connected module |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/` | Gateway root; HTML shell for browser or JSON health-ish root for API callers | Optional `Accept: text/html` | HTML gateway or `{ ok, name, time, request_id }` | Public | `server.mjs` |
| `GET` | `/operator` | Operator console HTML | none | HTML | Admin token/cookie required | `server.mjs` + `src/middleware/adminAccess.mjs` |
| `GET` | `/operator/:asset` | Operator JS/CSS assets | `asset in {app.js,styles.css}` | JS/CSS | Admin token/cookie required | `server.mjs` |
| `GET` | `/app` | Main Spiritverse app HTML | none | HTML with build marker header | Public | `server.mjs` |
| `GET` | `/command-center` | Command Center HTML | none | HTML | Admin token/cookie required | `server.mjs` |
| `GET` | `/command-center.js` | Command Center runtime JS | none | JS | Admin token/cookie required | `server.mjs` |
| `GET` | `/command-center.css` | Command Center CSS | none | CSS | Admin token/cookie required | `server.mjs` |
| `GET` | `/app/:asset` | Main frontend runtime files | asset whitelist | JS/CSS/SVG/JPG | Public | `server.mjs` |
| `GET` | `/app/data/:asset` | Frontend data manifests/canon | asset whitelist | JS module | Public | `server.mjs` |
| `GET` | `/app/active-assets/*` | ACTIVE asset runtime serving | path wildcard | image/video/file bytes | Public | `server.mjs` |
| `GET` | `/app/assets/*` | ACTIVE asset compatibility alias | path wildcard | image/video/file bytes | Public | `server.mjs` |
| `GET` | `/app/spiritkin-videos/*` | Spiritkin video manifest/runtime file serving | path wildcard | file bytes | Public | `server.mjs` |
| `GET` | `/app/game-theme-assets/*` | Premium game asset alias | path wildcard | file bytes | Public | `server.mjs` |
| `GET` | `/app/game-concept-assets/*` | Game concept compatibility alias | path wildcard | file bytes | Public | `server.mjs` |
| `GET` | `/app/premium-game-assets/*` | Premium game asset alias | path wildcard | file bytes | Public | `server.mjs` |
| `GET` | `/generated-spiritkins/*` | Generated Spiritkin runtime asset serving | path wildcard | file bytes | Public | `server.mjs` |
| `GET` | `/portraits/:filename` | Legacy portrait PNG serving | whitelisted filename | PNG | Public | `server.mjs` |
| `GET` | `/videos/:filename` | Intro/cinematic MP4 serving | allowed runtime filename | MP4 | Public | `server.mjs` + `spiritkinRuntimeConfig.js` |
| `GET` | `/world-art/:filename` | Legacy world-art compatibility serving | whitelisted filename | image bytes | Public | `server.mjs` |

### Live public v1 routes

| Method | Path | Purpose | Expected input | Expected output | Auth/session assumptions | Connected module |
| --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/v1/interact` | Main SpiritCore interaction pipeline | `{ userId, input, spiritkin?, conversationId?, context? }` | `{ ok, message, spiritkin, safety, metadata, session? }` | Public; `conversationId` is functionally required by orchestrator even though schema marks it optional | `src/routes/interact.mjs` -> `src/services/orchestrator.mjs` |
| `GET` | `/v1/spiritkins` | List canonical Spiritkins | none | `{ ok, count, spiritkins[] }` | Public | `src/routes/spiritkins.mjs` |
| `GET` | `/v1/spiritkins/:name` | Fetch one canonical Spiritkin | `name` path param | `{ ok, spiritkin }` or `404` | Public | `src/routes/spiritkins.mjs` |
| `POST` | `/v1/conversations` | Bootstrap conversation and session snapshot | `{ userId, spiritkinName, title?, userName? }` | `{ ok, conversation, engagement, session }` | Public; creates persistent records | `src/routes/conversations.mjs` |
| `GET` | `/v1/conversations/:userId` | List a user's recent conversations | path `userId`, optional `limit` | `{ ok, count, conversations[] }` | Public; caller must know user id | `src/routes/conversations.mjs` |
| `GET` | `/v1/session/snapshot` | Return SpiritCore session/control snapshot | query `userId`, optional `conversationId`, `spiritkinName`, surface/mode/tab | `{ ok, session }` | Public; reads current world/session state | `src/routes/session.mjs` -> `src/services/sessionControlService.mjs` |
| `POST` | `/v1/session/control` | Persist current UI/session control hints | `{ userId, conversationId?, currentSpiritkinName?, currentSurface?, currentMode?, activeTab?, speechState? }` | `{ ok, session }` | Public; writes world-state-backed session flags | `src/routes/session.mjs` -> `src/services/sessionControlService.mjs` |
| `POST` | `/v1/spiritcore/welcome` | Build Crown Gate welcome copy | `{ userId, userName, returning?, primarySpiritkinName? }` | `{ ok, greeting }` | Public; no conversation required | `src/routes/spiritcore.mjs` |
| `GET` | `/v1/games/list` | List available games | none | `{ ok, count, games }` | Public | `src/routes/games.mjs` |
| `POST` | `/v1/games/start` | Start a game in a conversation | `{ userId, conversationId, gameType, spiritkinName? }` | `{ ok, game, spiritkinMessage, instructions, guide, session }` | Public; mutates world/game state | `src/routes/games.mjs` -> `gameEngine`, `worldService`, `sessionControlService` |
| `POST` | `/v1/games/move` | Submit a game move | `{ userId, conversationId, move, spiritkinName? }` | `{ ok, game, spiritkinMessage, session }` | Public; mutates world/game state | `src/routes/games.mjs` |
| `POST` | `/v1/games/draw` | Draw card in Spirit Cards | `{ userId, conversationId, spiritkinName? }` | `{ ok, game, spiritkinMessage, session }` | Public; mutates world/game state | `src/routes/games.mjs` |
| `GET` | `/v1/games/state/:conversationId` | Fetch active game + session state | path `conversationId`, query `userId` | `{ ok, game, session }` | Public | `src/routes/games.mjs` |
| `POST` | `/v1/games/end` | End/forfeit active game and process progression | `{ userId, conversationId, spiritkinName?, outcome? }` | `{ ok, game, message, session, progression }` | Public; mutates world/progression | `src/routes/games.mjs` + `worldProgression` |
| `GET` | `/v1/veil-crossing/questions` | Return resonance questionnaire | none | `{ ok, questions[] }` | Public | `src/routes/veilCrossing.mjs` |
| `POST` | `/v1/veil-crossing/calculate` | Score questionnaire and reveal founder | `{ answers: [10 option indexes] }` | `{ ok, spiritkin, scores, message }` | Public | `src/routes/veilCrossing.mjs` |
| `GET` | `/v1/bond-journal` | Return bond journal summary | query `userId`, `conversationId` | `{ ok, journal }` | Public | `src/routes/bondJournal.mjs` |
| `GET` | `/v1/spiritverse/events/current` | Current shared event view | optional query `bondStage` | `{ ok, event, temporal, next, timestamp }` | Public | `src/routes/spiritverseEvents.mjs` |
| `GET` | `/v1/spiritverse/events/all` | Event catalog | none | `{ ok, events, current }` | Public | `src/routes/spiritverseEvents.mjs` |
| `GET` | `/v1/quests/daily` | Daily quest generation | optional `userId`, `spiritkinName`, `bondStage` | `{ ok, quest, refreshesIn, timestamp }` | Public | `src/routes/dailyQuests.mjs` |
| `GET` | `/v1/quests/daily/next` | Preview next daily quest | optional `userId`, `spiritkinName`, `bondStage` | `{ ok, quest, availableAt, timestamp }` | Public | `src/routes/dailyQuests.mjs` |
| `POST` | `/v1/feedback` | Submit user feedback | `{ userId, spiritkinName, conversationId?, rating?, helpful?, emotionalResonance?, freeText?, messageId? }` | `{ ok, ...result }` | Public; writes analytics/feedback data | `src/routes/analytics.mjs` |
| `POST` | `/v1/analytics/event` | Submit session analytics event | `{ userId, eventType, conversationId?, spiritkinName?, ... }` | `{ ok }` | Public; writes analytics data | `src/routes/analytics.mjs` |
| `POST` | `/v1/issues/report` | Submit issue report | `{ reportText, userId?, conversationId?, spiritkinName?, sessionId?, sourceContext?, currentFeature? }` | `{ ok, captured, classification, record?, recovery }` or `429/400/503` | Public; capped and persistence-dependent | `src/routes/issues.mjs` |
| `POST` | `/v1/speech` | Generate TTS audio from active adapter | `{ text, voice }` | `audio/mpeg` or structured error | Public; config-dependent | `server.mjs` direct route |
| `POST` | `/v1/spiritkin/generate` | Generate a custom Spiritkin from survey | `{ answers, userName? }` | `{ ok, spiritkin }` | Public; directly depends on OpenAI config | `server.mjs` direct route |

### Live admin-protected routes

| Method | Path | Purpose | Expected input | Expected output | Auth/session assumptions | Connected module |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/metrics` | Runtime metrics counters | none | `{ ok, metrics }` | Admin token/cookie required | `src/routes/health.mjs` |
| `GET` | `/v1/admin/conversations/recent` | Recent conversations across users | optional `limit` | `{ ok, conversations[] }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/messages/:conversationId` | Transcript fetch | path `conversationId` | `{ ok, messages[] }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/stats` | Global counts | none | `{ ok, stats }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/issues/recent` | Recent issue reports | none | `{ ok, reports[] }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/issues/digest` | Issue digest | none | `{ ok, digest }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/issues/repair-packets` | Repair packets | optional `limit` | `{ ok, packets[] }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/issues/repair-handoff` | Repair handoff digest | optional `limit` | `{ ok, handoff }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/generator/summary` | Generator summary | none | `{ ok, summary }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/generator/jobs` | Generator jobs | optional `type`, `spiritkinKey` | `{ ok, jobs[] }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/admin/generator/providers/status` | Provider status | none | `{ ok, providers }` | Admin required | `src/routes/admin.mjs` |
| `POST` | `/v1/admin/generator/image` | Queue image generation job | generation job spec | `{ ok, ...result }` | Admin required; writes generator jobs | `src/routes/admin.mjs` |
| `POST` | `/v1/admin/generator/video` | Queue video generation job | generation job spec | `{ ok, ...result }` | Admin required; writes generator jobs | `src/routes/admin.mjs` |
| `POST` | `/v1/admin/generator/jobs/:jobId/execute` | Execute queued job | path `jobId`, optional `operation` | `{ ok, ...result }` | Admin required | `src/routes/admin.mjs` |
| `POST` | `/v1/admin/generator/jobs/:jobId/retry` | Retry job | path `jobId` | `{ ok, ...result }` | Admin required | `src/routes/admin.mjs` |
| `POST` | `/v1/admin/generator/review` | Review generated output | `{ outputId, decision, note?, markCanonical?, attachToRuntime? }` | `{ ok, ...result }` | Admin required | `src/routes/admin.mjs` |
| `GET` | `/v1/analytics/spiritkin/:name` | Per-spiritkin analytics | path `name` | `{ ok, metrics }` | Admin required | `src/routes/analytics.mjs` |
| `GET` | `/v1/analytics/summary` | Aggregate analytics summary | none | `{ ok, summary, spiritkins }` | Admin required | `src/routes/analytics.mjs` |

### Live health and legacy compatibility routes

| Method | Path | Purpose | Expected input | Expected output | Auth/session assumptions | Connected module |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/health` | Liveness | none | `{ ok, service, version, env, ts }` | Public | `src/routes/health.mjs` |
| `GET` | `/ready` | Readiness check against Supabase/registry/container | none | `200` or `503` readiness payload | Public | `src/routes/health.mjs` |
| `POST` | `/runtime/interaction/:userId` | Legacy runtime interaction shim | `{ message, conversation_id?, spiritkin_id? }` | `{ ok, response, spiritkin_id?, conversation_id?, emotion?, context? }` | Public; bypasses orchestrator | `server.mjs` + `runtime/*` |
| `POST` | `/runtime/spirit/:userId` | Create runtime spirit instance | `{ profile? }` | `{ ok, userId, spirit }` | Public; bypasses orchestrator | `server.mjs` + `runtime/*` |
| `POST` | `/runtime/conversation/bootstrap` | Legacy conversation bootstrap shim | `{ conversation_id }` | `{ ok, context }` | Public | `server.mjs` + runtime controller |
| `GET` | `/runtime/context/:conversation_id` | Legacy conversation context lookup | path param | `{ ok, context }` | Public | `server.mjs` + runtime controller |
| `GET` | `/runtime/episodes/:conversation_id` | Direct episode listing | path param | `{ ok, episodes[] }` | Public | `server.mjs` direct Supabase query |
| `POST` | `/v0/message` | v0 model-plane message route | `{ conversation_id, content, mood?, options?, useLLM? }` | `{ ok, response, meta }` | Public; bypasses SpiritCore orchestrator | `server.mjs` |
| `GET` | `/v0/health` | Legacy DB health check | none | `{ ok, db_ok }` | Public | `server.mjs` |
| `POST` | `/v0/conversations` | Legacy conversation create | `{ title? }` | `{ ok, conversation }` | Public; writes DB | `server.mjs` |
| `GET` | `/v0/world_state/:conversation_id` | Legacy world state lookup | path param | `{ ok, world_state }` | Public | `server.mjs` |
| `POST` | `/v0/world_state/:conversation_id` | Legacy world state write | `{ state_json? }` | `{ ok, world_state }` | Public; writes DB | `server.mjs` |
| `GET` | `/v0/memory/list/:conversation_id` | Legacy memory list | path param, optional `limit` | `{ ok, items[] }` | Public | `server.mjs` |
| `POST` | `/v0/memory/pin` | Legacy memory pin | `{ memory_id }` | `{ ok, pinned }` | Public; mutates DB | `server.mjs` |

### Route modules present in repo but not registered live

| Declared path(s) | Status | Why it matters |
| --- | --- | --- |
| `/world/state` (`GET`, `POST`) | Not registered | World state has both live authority routes and dead utility routes; this is fragmentation risk. |
| `/memory/query`, `/memory/policy` | Not registered | Memory is central to SpiritCore, but these read routes are not exposed live. |
| `/entitlements/check` | Not registered | Entitlements are used internally by orchestrator, but no live external route is currently registered. |

## 2. Endpoint health results

### Diagnostic method

- Added `scripts/endpoint-diagnostics.mjs`.
- The script starts `server.mjs` on an isolated local port, waits for `/health`, then probes only safe runtime endpoints.
- Tested locally on `http://127.0.0.1:3115`.

### Safe endpoint result

- `31/31` tested safe endpoints returned successful responses.
- Tested surfaces:
  - `/health`
  - `/ready`
  - `/v0/health`
  - `/app`
  - `/app/app.js`
  - `/app/data/spiritverseCanon.js`
  - `/app/assets/concepts/Solis.png`
  - `/app/game-theme-assets/Checkers/boards/checkers_board_premium_placeholder.svg`
  - `/app/spiritkin-videos/README.md`
  - `/portraits/lyra_portrait.png`
  - `/videos/lyra_intro.mp4`
  - `/v1/spiritkins`
  - `/v1/spiritkins/Lyra`
  - `/v1/spiritcore/welcome`
  - `/v1/veil-crossing/questions`
  - `/v1/veil-crossing/calculate`
  - `/v1/spiritverse/events/current`
  - `/v1/spiritverse/events/all`
  - `/v1/quests/daily`
  - `/v1/games/list`
  - `/v1/conversations`
  - `/v1/conversations/:userId`
  - `/v1/session/snapshot`
  - `/v1/session/control`
  - `/v1/bond-journal`
  - `/runtime/conversation/bootstrap`
  - `/runtime/context/:conversation_id`
  - `/runtime/episodes/:conversation_id`
  - `/v1/games/state/:conversationId`
  - `/v1/interact`
  - `/v1/speech`

### Non-fatal issues exposed by the diagnostic logs

- `user_engagement` table is not present in the current Supabase schema cache.
  - Result: engagement updates degrade instead of persisting.
- `memories.kind` column is missing from the active schema.
  - Result: structured memory lookups degrade on every session snapshot/interact path.
- `episodes.content` column is missing from the active schema.
  - Result: episode writes fail during interaction processing.
- `emotion_state.arousal` column is missing from the active schema.
  - Result: emotion-state persistence fails during interaction processing.

These do not currently break the public endpoint responses because the backend degrades gracefully, but they materially reduce SpiritCore authority depth.

## 3. SpiritCore authority map

### Fully or primarily governed by SpiritCore now

- Identity resolution
  - `identityGovernor` resolves canonical Spiritkin identity and checks drift.
- Main conversation flow
  - `/v1/interact` runs through the orchestrator and is the primary governed pipeline.
- Safety/governance
  - `safetyGovernor` pre-pass and post-pass govern all orchestrated responses.
- Session and UI guidance payloads
  - `sessionControlService` plus `spiritCoreAdaptiveService` produce session snapshot, surface priority, guidance, return package, and ambient foundation payloads.
- World-state reaction
  - `worldService.reactToInteraction` and `worldProgression` update bond/world flags after interactions and games.
- Voice/wake context handoff
  - Not governed as audio execution, but the interaction/session context carries speech-state and mode hints for frontend continuity.
- Game/session context
  - Current game state is written into world flags and reflected back through session snapshots and interact metadata.
- Ambient foundation
  - `spiritCoreAdaptiveService` emits `spiritCoreAmbientFoundation` and persists descriptive ambient hooks in world flags.
- Adaptive profile and communication style model
  - `spiritCoreAdaptiveService` builds a bounded style model: formality, casualness, emotional heaviness, directness, verbosity, playfulness, plus preference memory flags.

### Partially governed

- Memory
  - Orchestrator calls memory, hierarchical memory, spirit memory, and structured memory services.
  - Actual structured memory authority is weakened by schema drift on `memories.kind`.
- Emotion tracking
  - Emotion derivation exists and is used in runtime flow.
  - Persistence is weakened by schema drift on `emotion_state`.
- Episodes/context continuity
  - Episode service is called from orchestrator.
  - Persistence is weakened by schema drift on `episodes.content`.
- Progression/events
  - World progression and events exist, but daily quests/events are service-local generators rather than orchestrator-decided next-step authority.
- Unique user experience shaping
  - Style model, surface priority, return package, and favored-Spiritkin context exist.
  - Long-term distinctiveness is limited while structured memory, engagement persistence, and emotion persistence are degraded.

### Not truly governed by SpiritCore

- `/v1/spiritcore/welcome`
  - Route-local greeting logic, not orchestrator-governed.
- `/v1/speech`
  - Direct adapter route; no SpiritCore policy or adaptive voice shaping layer.
- `/v1/spiritkin/generate`
  - Direct OpenAI generation path; not governed by orchestrator or safety governor.
- Legacy `/runtime/*` routes
  - Runtime shim layer bypasses main SpiritCore authority model.
- Legacy `/v0/*` routes
  - Direct compatibility plane bypasses orchestrator, safety, adaptive profile, and world authority.
- Frontend room/presence decisions
  - SpiritCore can emit guidance payloads, but actual shell/layout/presence behavior still resolves on the frontend.

## 4. Fragmented systems and gaps

### Confirmed gaps

- Legacy and modern stacks coexist.
  - `runtime/*` and `v0/*` remain live beside the v1 orchestrator stack.
- Dead route modules exist but are not registered.
  - `worldRoutes`, `memoryRoutes`, and `entitlementsRoutes`.
- Some SpiritCore-facing experiences are still route-local.
  - `spiritcore/welcome`, daily quests, events, and parts of game commentary are not orchestrator-governed.
- Frontend/session authority is still split.
  - SpiritCore can recommend surfaces and pacing, but it does not own shell behavior end-to-end.

### Confirmed schema drift

- `public.user_engagement` missing
- `memories.kind` missing
- `episodes.content` missing
- `emotion_state.arousal` missing

These are the biggest practical blockers to “SpiritCore fully governs the experience,” because they remove feedback loops that the code already expects to have.

### Unique-user-experience control assessment

Current capability:

- Memory-driven uniqueness: partial
- Adaptive style model: yes
- Preferred tone retention: partial
- Favored Spiritkin continuity: yes
- Chamber/domain emphasis: yes through `worldHooks`
- Activity recommendations: yes through `guidance` and `surfacePriority`
- Return-flow logic: yes through `returnPackage`
- Mood/context signals: yes in runtime envelope
- Ambient state foundation: yes, descriptive only

Current limitation:

- Because structured memory, engagement, emotion, and episode persistence are partially broken, much of the “unique per user” logic is present in code but not being reinforced by reliable long-term storage.

## 5. Recommended next upgrades

- Reconcile backend schema with current service expectations before any authority rewrite.
  - Add or align `user_engagement`
  - Align `memories.kind`
  - Align `episodes.content`
  - Align `emotion_state.arousal`
- Decide whether `runtime/*` and `v0/*` are still meant to be supported.
  - If yes, document them as compatibility APIs.
  - If no, plan a controlled shutdown.
- Move route-local greeting logic under SpiritCore authority if welcome/gating should be adaptive.
- Decide whether unregistered `memory/world/entitlements` routes should be registered or deleted.
- Add a formal backend diagnostics CI step that runs `scripts/endpoint-diagnostics.mjs` against a staged schema.

## 6. What should not be touched yet

- Do not rewrite the orchestrator pipeline.
- Do not redesign frontend room/presence/wake systems as part of backend authority cleanup.
- Do not attempt a broad migration away from Supabase during this pass.
- Do not expand admin/generator architecture until schema drift is corrected.
- Do not claim “full SpiritCore governance” until persistence for engagement, structured memory, episodes, and emotion state is actually restored.

## 7. Safe fixes applied during the audit

- Fixed `src/services/engagementEngine.mjs`
  - Removed invalid `.catch()` chaining on the Supabase query builder.
  - Now logs actual upsert failure reason cleanly.
- Fixed `src/services/sessionControlService.mjs`
  - Session-control world writes now resolve `spiritkin_id` from the active conversation or current Spiritkin name before persisting.
  - This removed the noisy `world_state.spiritkin_id` null-write failure during conversation/session setup.

## 8. Diagnostic command

```powershell
node scripts/endpoint-diagnostics.mjs
```
