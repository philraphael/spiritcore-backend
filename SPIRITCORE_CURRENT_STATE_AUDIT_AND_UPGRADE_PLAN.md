# SpiritCore Current-State Audit And Upgrade Plan

## Scope

This audit reflects the current SpiritCore / Spiritkins architecture as it exists now after the stabilization, media authority, trailer runtime, and theme-environment passes already in place.

It does not propose a reset. It identifies:

- what SpiritCore already governs well
- what is still fragmented across UI/state glue
- what can be safely elevated into SpiritCore next
- what should remain untouched until the current runtime proves itself further

---

## 1. What SpiritCore Already Governs

### 1.1 Backend orchestration is real and already authoritative

SpiritCore is not just frontend branding. The backend already has a genuine orchestration layer:

- `src/container.mjs`
  - central DI wiring point for orchestration, memory, world, safety, analytics, games, and session control
- `src/services/orchestrator.mjs`
  - authoritative request-to-response pipeline
  - identity resolution
  - context assembly
  - entitlement checks
  - safety pre-pass and post-pass
  - inbound/outbound persistence
  - adapter generation
  - memory writes
  - world reaction hooks
  - engagement recording

This means SpiritCore already governs the most important trust-critical layer: response generation and persistence flow.

### 1.2 SpiritCore already governs identity integrity

- `src/services/identityGovernor.mjs`
- `src/services/orchestrator.mjs`
- `src/services/conversationService.mjs`

Current behavior:

- canonical Spiritkin identity is resolved through registry-backed logic, not ad hoc frontend names
- drift checks happen after model generation
- Spiritkin conversations are anchored to canonical rows in storage

This is a strong foundation and should not be weakened.

### 1.3 SpiritCore already governs memory assembly and recall inputs

The memory layer is significantly more advanced than a basic chat transcript.

Current services:

- `src/services/memory.mjs`
- `src/services/memoryExtractor.mjs`
- `src/services/hierarchicalMemory.mjs`
- `src/services/structuredMemoryService.mjs`
- `src/services/spiritMemoryEngine.mjs`
- `src/services/contextService.mjs`
- `src/services/responseEngine.mjs`

Current SpiritCore-governed memory capabilities:

- raw memory querying
- hierarchical memory layers: semantic / episodic / procedural
- structured interaction memories: corrections, preferences, milestones, recurring topics, gameplay tendencies
- session summaries
- identity facts
- bond milestones
- game-session memory
- memory brief construction for adapter context
- memory-based response shaping and anti-repetition correction

This is already a serious adaptive substrate.

### 1.4 SpiritCore already governs world-state evolution

Current services:

- `src/services/world.mjs`
- `src/services/worldProgression.mjs`
- `src/canon/spiritverseEchoes.mjs`

Current capabilities:

- persistent world state per conversation
- scene, mood, description, bond stage, milestone count, echo unlocks, spiritverse event flags
- reaction to interaction based on emotion and significance
- progression changes after game completion
- lore/echo unlocks tied to interaction and game outcomes

This means SpiritCore already has real “world shaper” behavior, not just static theming.

### 1.5 SpiritCore already governs session continuity and control-plane truth

Current services/routes:

- `src/services/sessionControlService.mjs`
- `src/routes/session.mjs`
- `src/routes/interact.mjs`

Current capabilities:

- session snapshot generation
- coarse session-control persistence
- current surface / mode / active tab
- speech lifecycle state
- current game and conversation summaries
- memory context summaries exposed back to runtime
- UI/session reconciliation path after interaction

This is an important stabilization layer already in place.

### 1.6 SpiritCore already governs safety boundaries

Current services:

- `src/services/safetyGovernor.mjs`
- `src/services/safetyClassifier.mjs`
- orchestrator safety pre-pass / post-pass

Current behavior:

- safety escalation before normal interaction continues
- revised output after post-pass when needed
- persistence of crisis-safe response path

This is a hard boundary and should remain centralized in SpiritCore.

### 1.7 SpiritCore already governs analytics and engagement signals

Current services:

- `src/services/analyticsService.mjs`
- `src/services/engagementEngine.mjs`
- `src/routes/conversations.mjs`
- `src/routes/interact.mjs`

Current capabilities:

- per-interaction analytics
- per-session event logging
- spiritkin-level metrics
- return whisper generation
- milestone delivery
- echo unlock delivery
- wellness nudges

This is already an embryonic user-awareness layer.

---

## 2. What Is Fragmented Today

### 2.1 “SpiritCore guidance” in the UI is still mostly frontend-authored

Key file:

- `spiritkins-app/app.js`

Current frontend-owned logic:

- `getSpiritCoreGuidanceModel()`
- welcome/selection/bonded guidance cards
- next-step decision logic
- selection flow suggestions
- “what now?” behavior after early conversation

This works, but it is still driven by frontend conditional state such as:

- `primarySpiritkin`
- `pendingBondSpiritkin`
- `conversationId`
- `activePresenceTab`
- `activeGame`
- `messages.length`

That means current SpiritCore guidance is partly representational and partly UI-state glue, not true backend-orchestrated guidance.

### 2.2 Adaptive personality shaping is split and mostly local-first

Key file:

- `spiritkins-app/app.js`

Current local-only adaptive behavior:

- `adaptiveProfile`
- assistant style observation
- user tone preference extraction
- blocked openers / disliked phrases
- local correction flags
- Spiritkin evolution profile

This is useful, but fragmented:

- some adaptive intelligence exists in backend structured memory
- some similar logic exists only in local browser state
- there is no single authoritative adaptive profile contract shared across frontend and backend

This is one of the clearest upgrade opportunities.

### 2.3 Surface prioritization and focus hierarchy remain mostly UI decisions

The frontend currently decides:

- which surface should dominate
- what should scroll into view
- what “next action” is most relevant
- when guidance cards appear
- how much the game versus conversation should dominate

Session control persists coarse state, but SpiritCore does not yet truly choose surface priority based on user context. The UI still does.

### 2.4 Some world expression is visual-only rather than orchestration-driven

The backend already persists world state, bond stage, events, and scene changes.

But the frontend still independently decides much of:

- environment intensity
- theme emphasis
- where to surface world-state relevance
- when to promote events versus conversation versus games

That means world state exists, but SpiritCore is not yet fully deciding how strongly the experience should reorganize around it.

### 2.5 Return/retention intelligence is split across backend and browser-local state

Current frontend state includes:

- retention telemetry
- return summary
- daily moment / weekly moment
- adaptive profile
- resonance counts
- Spiritkin evolution store

Current backend stores:

- engagement state
- analytics sessions
- memory context
- world state

This is enough to be useful, but the responsibility boundary is blurry. Returning-user intelligence is not yet fully authoritative in one place.

---

## 3. User Model / Experience Model Inventory

## 3.1 Signals already available today

### Bond / relationship signals

- primary bonded Spiritkin
- selected Spiritkin
- pending bond target
- bond stage
- interaction count
- milestone count
- resonance count
- games completed together
- journal state

Sources:

- frontend local state
- `world_state`
- `sessionControlService`
- `worldProgression`
- `engagementEngine`

### Session / runtime continuity signals

- current surface
- current mode
- active tab
- current game
- speech state
- conversation state
- recent messages
- current Spiritkin identity

Sources:

- `sessionControlService`
- `/v1/session/snapshot`
- `/v1/session/control`

### Memory / personal preference signals

- semantic facts
- episodic milestones
- procedural patterns
- preferences
- aversions
- tone preferences
- respect preference
- spiritual preference
- corrections
- recurring topics
- recurring people
- gameplay tendencies
- emotional anchors

Sources:

- `structuredMemoryService`
- `hierarchicalMemory`
- `spiritMemoryEngine`
- `responseEngine`

### Emotional / conversational signals

- emotion label
- emotional arc
- intensity
- session summaries
- last summary episode

Sources:

- `emotionService`
- `episodeService`
- `contextService`
- `spiritMemoryEngine`

### World / experience signals

- scene name
- scene mood
- scene description
- spiritverse event
- echo unlocks
- bond-stage realm progression
- game-driven world mood changes

Sources:

- `world`
- `worldProgression`
- `spiritverseEchoes`

### Behavioral / product signals

- interaction counts
- session starts
- session abandons
- first-message timing
- latency
- response length
- rating feedback
- drop-off counts

Sources:

- `analyticsService`

### Engagement / return signals

- last session at
- last emotion label
- last arc
- last session minutes
- sustained intensity
- whisper type
- milestone reveal eligibility
- wellness nudge eligibility

Sources:

- `engagementEngine`

## 3.2 Signals that exist only weakly or are fragmented

- authoritative “current user intent” model
  - conversation support vs play vs exploration vs reflection
- authoritative clutter / pacing model
  - what should be hidden, collapsed, or promoted right now
- authoritative surface-priority model
  - which major surface should lead this moment
- authoritative return-state summary model
  - what should be highlighted first when the user comes back
- unified adaptive profile
  - backend memory-derived + frontend local-derived signals merged into one bounded contract

---

## 4. Responsibility Boundary Map

## 4.1 What SpiritCore already owns and should keep owning

- canonical identity resolution
- conversation bootstrap and persistence
- response orchestration
- safety gating
- context assembly
- structured memory retrieval
- world-state mutation
- session snapshot and control state
- engagement state generation
- analytics event ingestion

## 4.2 What currently sits at Spiritkin level but should increasingly be SpiritCore-owned

- next-step suggestion selection
- post-action “what now?” branching
- when to emphasize play versus conversation versus world exploration
- when to surface milestone / whisper / event / journal over standard conversation
- how returning-user continuity should be staged

The Spiritkin should remain the voice. SpiritCore should increasingly decide the pacing and surfacing.

## 4.3 What currently sits in UI glue but should increasingly be elevated

- guidance-card decision rules
- surface focus prioritization
- context-driven clutter reduction
- return flow prioritization
- world-state emphasis selection
- adaptive surface ordering

## 4.4 What should stay in the UI

- visual rendering
- animation / transition timing
- local media lifecycle
- local click/scroll/focus mechanics
- optimistic presentation timing where it does not claim authority over state

The frontend should remain the renderer and interaction shell, not the place where SpiritCore’s deeper policy decisions live.

---

## 5. Biggest Safe Upgrade Opportunities

## 5.1 Elevate next-action selection into SpiritCore

Current state:

- next-step guidance is frontend-authored in `app.js`

Safe upgrade:

- add a backend `experience guidance` payload built from existing session, world, engagement, and memory signals
- let frontend render that guidance instead of deciding it entirely itself

Why high leverage:

- improves coherence without changing existing response generation
- reduces duplicated logic
- keeps UI lighter

## 5.2 Add a bounded surface-priority model

Current state:

- surface dominance is mostly UI logic

Safe upgrade:

- introduce a SpiritCore decision contract like:
  - `primarySurface`
  - `secondarySurface`
  - `promoteReason`
  - `deemphasize`

Use only for non-destructive ranking, not forced takeover.

Why high leverage:

- reduces clutter
- improves “what am I supposed to do now?”
- makes return flow stronger

## 5.3 Unify adaptive profile signals

Current state:

- backend structured memory already captures preferences and corrections
- frontend local adaptive profile duplicates part of that logic

Safe upgrade:

- define a shared adaptive-profile payload generated from backend memory, optionally merged with local runtime-only observations
- use it for rendering and response shaping

Why high leverage:

- reduces drift
- makes personalization more stable across devices/sessions
- builds on systems that already exist

## 5.4 Strengthen world-state surfacing, not just world-state storage

Current state:

- world state exists and evolves, but SpiritCore only weakly decides when it should dominate the experience

Safe upgrade:

- add bounded world-emphasis recommendations:
  - when to foreground realm events
  - when to foreground bond milestone language
  - when to foreground quiet continuity instead

Why high leverage:

- makes the world feel governed
- avoids random visual or copy clutter

## 5.5 Improve return-flow orchestration

Current state:

- engagement engine creates whispers and nudges
- frontend chooses much of the rest of the re-entry experience

Safe upgrade:

- let SpiritCore build a `return package`:
  - whisper
  - top continuity item
  - recommended first action
  - whether to foreground conversation, game, journal, or event

Why high leverage:

- improves retention and clarity
- uses existing data instead of inventing new data

---

## 6. Adaptive Intelligence Plan

## Stage 1 — Consolidate decision payloads without changing core behavior

Goal:

- stop duplicating orchestration decisions in the UI

Build:

- backend-generated `experienceGuidance`
- backend-generated `surfacePriority`
- backend-generated `returnPackage`

Do not change:

- orchestrator response path
- safety path
- session-control schema except by additive fields

## Stage 2 — Unify adaptive user model contract

Goal:

- create one bounded, inspectable adaptive model

Build:

- merge structured-memory preferences + corrections + gameplay tendencies + engagement signals into a normalized profile
- expose only the small derived profile needed for UI and adapter shaping

Candidate fields:

- communication style
- intensity preference
- respect preference
- spirituality preference
- repetition sensitivity
- gameplay appetite
- reflection appetite
- continuity appetite

Do not:

- dump raw personal memory into UI
- create opaque hidden scoring that cannot be reasoned about

## Stage 3 — Make SpiritCore a true experience orchestrator

Goal:

- SpiritCore decides pacing and emphasis, not just content generation

Build:

- bounded rules for:
  - which surface leads
  - when milestones interrupt normal flow
  - when to reduce clutter
  - when to promote world-state material

Still bounded:

- SpiritCore suggests and prioritizes
- frontend renders
- user remains free to override

## Stage 4 — Add lightweight learning loops

Goal:

- allow SpiritCore to improve guidance quality over time

Build:

- outcome tracking for recommended actions:
  - did user follow it
  - did they stay
  - did they switch surface immediately
  - did they abandon

Use:

- analytics and engagement only
- no manipulative optimization

Purpose:

- improve clarity and pacing decisions
- not maximize compulsion

---

## 7. Safety / Governance Check

Every SpiritCore upgrade should satisfy these constraints.

## 7.1 Why the proposed upgrades are safe

- they are additive to existing architecture
- they do not replace the orchestrator, safety governor, or memory stack
- they mostly elevate already-existing signals into clearer decision payloads
- they reduce frontend drift rather than expanding behavioral power recklessly

## 7.2 How they stay bounded

- SpiritCore may prioritize and suggest; it should not secretly force routes or trap the user
- session control remains inspectable
- world-state emphasis remains reversible and contextual
- adaptive profile should be small, typed, and explainable

## 7.3 How they avoid manipulative behavior

Do not optimize for raw engagement alone.

Instead optimize for:

- clarity
- continuity
- reduced confusion
- meaningful pacing
- respect for user energy

Specific guardrails:

- wellness nudges remain allowed to interrupt extended use
- no dark patterns around return prompts
- no forced emotional escalation
- no fake urgency for realm events

## 7.4 How they respect data minimization

- prefer derived profile summaries over raw memory dumps
- keep UI payloads small and purpose-bound
- do not expose unnecessary personal history to the frontend
- keep memory retrieval selective and relevance-scored

---

## 8. What Should Not Be Changed Yet

- orchestrator interaction pipeline in `src/services/orchestrator.mjs`
- safety pre-pass / post-pass structure
- identity-governor authority
- session-control canonical snapshot path
- world-state schema unless additive
- trailer/runtime/media authority passes already in place
- theme-environment authority path already in place

These are now part of the project’s stability base.

Also do not yet:

- replace frontend guidance wholesale before backend guidance payloads exist
- collapse all local adaptive logic into backend in one pass
- redesign world-state architecture
- rewrite SpiritCore into a monolithic “AI decides everything” layer

---

## 9. Recommended Staged Roadmap

## Phase A — Audit-driven consolidation

- add a backend-generated `experienceGuidance` payload
- mirror current frontend decision rules first
- use it side-by-side with current frontend logic until parity is proven

## Phase B — Surface priority and return package

- add `surfacePriority` and `returnPackage`
- drive welcome/re-entry and clutter reduction from backend signals

## Phase C — Unified adaptive profile

- define one inspectable adaptive profile contract
- merge backend structured memory with selected frontend observations
- stop duplicating correction and tone logic in multiple places

## Phase D — SpiritCore pacing authority

- SpiritCore suggests when to foreground conversation, games, journal, events, or quiet return continuity
- frontend remains the renderer

## Phase E — Learning without manipulation

- measure whether guidance improved comprehension, continuation, and surface coherence
- keep wellness and non-coercive design as hard constraints

---

## 10. Bottom Line

SpiritCore is already more than a theme layer. It already governs:

- identity
- safety
- response orchestration
- memory assembly
- world-state mutation
- session truth
- engagement signals

The biggest gap is not missing architecture. The biggest gap is that experience-level decisions are still partly stranded in frontend glue.

That means the safest path forward is:

1. keep the current backend architecture
2. elevate UI guidance and surface-priority decisions into SpiritCore gradually
3. unify adaptive signals instead of duplicating them
4. preserve strict safety, boundedness, and data minimization throughout

This is an upgrade path, not a rebuild.
