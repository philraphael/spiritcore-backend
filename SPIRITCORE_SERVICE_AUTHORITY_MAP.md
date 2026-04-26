# SpiritCore Service Authority Map

Date: 2026-04-26

This map assigns authority and reuse rules for the service layer so future work extends existing modules instead of creating duplicate pipelines.

| Service/module | Authority classification | Do not duplicate? | Reusable by media pipeline | Reusable by premium generation | Cleanup status |
|---|---|---:|---:|---:|---|
| `src/services/orchestrator.mjs` | Authoritative conversational runtime | Yes | Indirectly | Yes | Stable |
| `src/services/identityGovernor.mjs` | Authoritative Spiritkin identity/canon | Yes | Yes | Yes | Needs media prompt adapter |
| `src/models/spiritkinIdentity.mjs` | Authoritative identity validation helper | Yes | Yes | Yes | Stable |
| `src/services/safetyGovernor.mjs` | Authoritative safety layer | Yes | Yes | Yes | Needs media prompt preflight wrapper |
| `src/services/safetyClassifier.mjs` | Safety helper | Yes | Yes | Yes | Stable |
| `src/services/memory.mjs` | Authoritative base memory service | Yes | Later approved continuity only | Yes | Stable |
| `src/services/hierarchicalMemory.mjs` | Memory helper/service | Yes | Later approved continuity only | Yes | Stable |
| `src/services/structuredMemoryService.mjs` | Authoritative structured memory service | Yes | Later approved continuity only | Yes | Stable |
| `src/services/spiritMemoryEngine.mjs` | Authoritative SpiritMemory engine | Yes | Later approved continuity only | Yes | Stable |
| `src/services/emotionService.mjs` | Authoritative emotion state service | Yes | Runtime asset selection | Yes | Stable |
| `src/services/episodeService.mjs` | Authoritative episode service | Yes | Approved media milestones only | Yes | Stable |
| `src/services/world.mjs` | Authoritative world_state service | Yes | Realm/environment references | Yes | Stable |
| `src/services/worldProgression.mjs` | World progression helper | Yes | Future unlock/media continuity | Yes | Stable |
| `src/services/sessionControlService.mjs` | Authoritative startup/session flow | Yes | Runtime media selection | Yes | Stable |
| `src/adapters/openai.shared.mjs` | Language/TTS adapter helper | Yes | Speech sync only | Yes | Keep separate from Runway |
| `src/services/runwayProvider.mjs` | Authoritative Runway provider boundary | Yes | Yes | Later server-side execution | Stable, extend only here |
| `src/services/spiritCoreMediaProduction.mjs` | Authoritative media planning/domain service | Yes | Yes | Yes | Central media service |
| `src/services/sourceStillIngestService.mjs` | Authoritative source still ingest | Yes | Yes | Yes | Stable |
| `src/services/mediaAssetIngestService.mjs` | Authoritative approved output ingest | Yes | Yes | Yes | Stable |
| `src/services/generatedAssetPipeline.mjs` | Helper/overlap risk for generated asset paths | Avoid duplicate promotion paths | Yes | Later | Needs convergence with media promotion |
| `src/services/spiritkinGeneratorService.mjs` | Legacy/overlap generator job foundation | Do not expand | Bridge only | Needs migration | Cleanup later |
| `src/services/spiritkinGeneratorProviderStack.mjs` | Legacy/overlap provider stack | Do not expand | Bridge only | Needs migration | Cleanup later |
| `src/services/entitlements.mjs` | Authoritative entitlement checks | Yes | Yes | Yes | Needs premium media gates |
| `src/services/issueReportService.mjs` | Issue/self-repair foundation | Yes | Future failed-job repair reports | Yes | Add media recovery later |
| `src/services/analyticsService.mjs`, `feedbackService.mjs` | Analytics/feedback helpers | Yes | Future operator reporting | Yes | Stable |
| `src/services/gameEngine.mjs`, `sharedGameEngine.mjs` | Game runtime services | Yes | Approved game media only | Later | Stable |

## Specific audit notes

### `spiritCoreMediaProduction.mjs`

This is the canonical media domain service. It owns asset kinds, lifecycle states, media requirements, production sequence planning, source reference planning, motion-pack planning, SpiritGate planning, sequence composition planning, and media catalog summaries. Future media planning should extend this service rather than create a new image/video generator abstraction.

### `runwayProvider.mjs`

This is the only Runway provider boundary. Provider payload construction, auth checks, generation submission, and task status parsing belong here. No command-center or route handler should construct raw Runway payloads independently.

### `sourceStillIngestService.mjs`

This owns canonical source still file naming, APPROVED/source_stills paths, sidecar metadata, and optional raw archive copy. It must not write ACTIVE or manifests.

### `mediaAssetIngestService.mjs`

This owns approved reviewed output ingest for generated clips/assets. It must not write ACTIVE or manifests. It complements source still ingest but should remain separate because source stills are references and motion outputs are generated media assets.

### `generatedAssetPipeline.mjs`

This is a helper and overlap risk. It can remain for dry-run promotion planning, but before any ACTIVE promotion exists the project should pick one canonical promotion contract, preferably under `/admin/media/*`.

### `spiritkinGeneratorService.mjs` and `spiritkinGeneratorProviderStack.mjs`

These are legacy/overlap generator foundations used by older `/v1/admin/generator/*` routes. Do not expand them for new Runway media work. If command center still needs those job concepts, bridge them to `spiritCoreMediaProduction.mjs`, `runwayProvider.mjs`, and approved ingest services.

## Voice, wake, and speech alignment

- Speech/TTS remains the voice authority.
- Runway clips remain silent motion shells.
- Wake/session startup should later select approved `greeting_or_entry`, `idle`, `listen`, and `speaking` assets only after promotion.
- Continuous voice and wake detection are runtime layers, not media generation layers.
- Media phases should not modify voice behavior unless explicitly requested.

## Self-repair and recovery alignment

The issue report system and admin repair packet routes exist and can become the recovery surface. A later media recovery phase should detect failed provider jobs, missing source stills, missing approved assets, stale `review_required` states, orphaned metadata, and blocked premium pack generation. It must not auto-promote or overwrite assets.
