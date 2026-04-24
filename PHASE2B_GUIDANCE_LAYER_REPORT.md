# PHASE 2B — Guidance Layer Report

## Files Changed

- [src/services/guidanceService.mjs](/C:/spiritcore-backend/src/services/guidanceService.mjs)
- [src/services/contextService.mjs](/C:/spiritcore-backend/src/services/contextService.mjs)
- [src/services/orchestrator.mjs](/C:/spiritcore-backend/src/services/orchestrator.mjs)
- [src/adapters/openai.shared.mjs](/C:/spiritcore-backend/src/adapters/openai.shared.mjs)

## Guidance Fields Added

The new backend guidance layer returns a bounded JSON object with:

- `intent`
- `confidence`
- `tone`
- `response_directive`
- `next_surface`
- `suggested_action`
- `emotional_priority`
- `memory_priority`
- `world_mood`
- `safety_note`
- `should_prompt_user`

## How Intent Detection Works

`guidanceService` uses bounded heuristics over:

- current user message
- current emotion label/tone
- recent conversation
- session surface/mode
- active game/world state

Supported intent categories:

- `emotional_support`
- `decision_help`
- `confusion`
- `storytelling`
- `gameplay`
- `journaling`
- `exploration`
- `practical_help`
- `casual_chat`
- `distress_signal`

Each intent is scored from explicit phrase cues and active session/world hints. The highest score wins, with a bounded confidence value.

## How Next Surface / Action Guidance Works

The service recommends a backend-only next surface without changing any frontend behavior directly.

Examples:

- `distress_signal` -> `rest`
- `gameplay` -> `games`
- `journaling` -> `journal`
- `exploration` -> `events`
- `decision_help` / `practical_help` -> `conversation` or `profile`

It also emits a `suggested_action` such as:

- `stabilize-and-reduce-pressure`
- `continue-active-game`
- `offer-reflection-or-journal-entry`
- `give-clear-next-step`
- `clarify-one-point-at-a-time`
- `provide-steps`

This is attached to adapter context as `context.guidance`.

## How Safety Fallback Works

The guidance layer is fail-safe:

- guidance build runs inside `try/catch`
- if it fails, the orchestrator logs `[Guidance] fallback`
- `/v1/interact` continues normally
- no route contract changes were introduced

This means the guidance layer is advisory, not authoritative over route success.

## Adapter Injection

The OpenAI adapter now includes a dedicated prompt block:

- `SPIRITCORE GUIDANCE LAYER`

It injects:

- intent
- tone
- response directive
- emotional priority
- memory priority
- next surface
- suggested action
- world mood
- safety note

The model is instructed to use this to shape the response without exposing internal labels unless naturally useful.

## Diagnostic Result

Commands run:

- `node --check src/services/guidanceService.mjs`
- `node --check src/services/contextService.mjs`
- `node --check src/services/orchestrator.mjs`
- `node --check src/adapters/openai.shared.mjs`
- `node scripts/endpoint-diagnostics.mjs`

Result:

- `31/31` endpoints passed
- `/v1/interact` returned `200`
- no route regression observed
- diagnostics logs showed `[Guidance] built`

## Remaining Risks

- Intent detection is heuristic and intentionally bounded; it is not a planner yet.
- The guidance layer does not persist standalone history; it derives from current interaction + existing Phase 2A context.
- Existing non-blocking warnings remain unchanged:
  - module type warning for `spiritkins-app/package.json`
  - no Spiritkins image generation provider configured
  - no Spiritkins video generation provider configured

