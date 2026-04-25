# Full System Production Readiness Audit

Date: 2026-04-25  
Scope: SpiritCore backend, Spiritkins frontend, SpiritCore authority, persistence contracts, voice/wake, games, PWA/mobile, assets/media, security/privacy, performance, testing, and Runway readiness.  
Mode: Diagnostic/reporting only. No code, schema, or asset changes were made.

## 1. Executive Summary

SpiritCore is functional for internal testing and has a real v1 orchestration path, working endpoint diagnostics, guarded manual/wake voice behavior, a mounted PWA shell, and a usable games foundation. It is not yet ready for public beta or production because production-critical surfaces still rely on compatibility routes, frontend-local state, placeholder/missing media, broad service-role backend authority, and limited automated regression coverage.

The strongest production foundation is `/v1/interact`: it resolves identity, assembles memory/context/world state, applies safety pre/post checks, calls the active adapter, persists messages/emotion/episodes/memory artifacts, and returns a structured session-aware response. The weakest foundations are media completeness, test coverage, route/schema consolidation, frontend full-root rendering, and privacy/compliance polish around microphone and memory retention.

## 2. Production Readiness Score

**64 / 100**

Internal testing is viable. Closed beta is reachable after targeted fixes. Public beta and production launch need route cleanup, media fallback hardening, automated smoke coverage, privacy disclosures, and deployment hardening.

## 3. Launch Readiness

| Stage | Readiness | Notes |
| --- | --- | --- |
| Internal testing | Yes | Core diagnostics pass; syntax checks pass; useful for controlled QA. |
| Closed beta | Not yet | Requires media 404 cleanup, privacy UX, route/security review, and smoke tests. |
| Public beta | No | Needs automated browser/mobile/PWA/game checks and clearer persistence contract. |
| Production launch | No | Requires security/compliance pass, observability, schema verification, and scale testing. |

## 4. Critical Blockers

1. Missing Spiritkin video assets are still referenced by manifest paths, producing real 404s such as `/app/spiritkin-videos/Kairo/idle/idle_01.mp4` and `/app/spiritkin-videos/Kairo/speaking/speaking_01.mp4`.
2. There is no root `npm test`, `npm run lint`, or `npm run build`, so launch regression gates are absent.
3. Legacy `/runtime/*` and `/v0/*` routes remain live in `server.mjs` and can bypass current SpiritCore authority/persistence contracts.
4. Frontend render architecture still uses full `root.innerHTML = buildApp()` and many direct `render()` calls; game board preservation is signature-based, not component/state isolated.
5. Database/schema alignment is only inferred from code and migrations; no live schema verification command was found/run beyond endpoint behavior.
6. Admin routes depend on env configuration; local `auto` bypass is acceptable for development but must be enforced and verified in every deployed environment.

## 5. High-Priority Issues

- `/v1/spiritcore/welcome`, quests, events, veil crossing, bond manager copy, and much presence logic are partly frontend/service-driven rather than fully governed by the orchestrator.
- `/v1/games/*` uses `gameEngine`, `world`, and orchestrator commentary for moves, but game start/list/state/end are not fully SpiritCore-governed conversational turns.
- `server.mjs` mixes static serving, legacy APIs, compatibility aliases, generator endpoints, TTS, and route registration in one large file.
- Several route files exist but are not registered: `src/routes/entitlements.mjs`, `src/routes/memory.mjs`, and `src/routes/world.mjs`.
- `src/routes/games.mjs` lacks Fastify schemas for most request bodies and responses.
- `/v1/speech` validates only `text` and `voice`; no length cap, voice allowlist, content policy, or cost/rate isolation beyond global route behavior was observed.
- Service-layer degradation often logs and continues, which protects UX but can hide persistence failures in memory/emotion/episode/adaptive profile paths.
- `spiritkins-app/app.js` is very large and contains rendering, state, copy, voice, games, PWA, onboarding, and bond-management logic in one file.
- `.gitignore` excludes SQL migrations while migration SQL files are present in the root, creating repo policy drift.
- Many root-level implementation reports and temporary verification folders clutter production orientation.

## 6. Medium-Priority Issues

- `spiritkins-app/package.json` lacks `"type": "module"`, causing Node module-type warnings during diagnostics.
- Service worker cache is `spiritkins-shell-v1` and does not include the build marker, so stale shell behavior is possible across deploys.
- Manifest icons/splash assets are referenced but should be verified for final beta branding and maskable/icon purpose coverage.
- Presence engine writes local storage and triggers renders on return/focus; guards exist, but this remains frontend-local rather than server-governed.
- Wake mode is foreground-only and correctly paused by design, but UX copy must clearly state it is not background/native wake.
- Asset organization has ACTIVE, Game_Themes, ARCHIVE, INCOMING, and processed waves, but duplicated placeholder assets appear in ACTIVE, Game_Themes, and ARCHIVE.
- Console noise is high in diagnostics: request logs, ContextService logs, Guidance logs, Orchestrator prompt-context logs, Voice logs, and module warnings.
- Game UI is functional but still theme-placeholder heavy and should receive a design-system pass before beta.
- `/app/:asset` and static aliases support compatibility, but add routing complexity and cache/404 ambiguity.

## 7. Low-Priority Polish

- Copy leans heavily mystical in older Spiritkin origin and presence lines.
- Some phrasing is repetitive: "I'm here", "The bond has deepened", "SpiritCore is listening", "realm", "echo", "presence".
- Some game commentary is temporary and overly theatrical.
- Root report/docs history should be archived into `docs/reports/` or a dated archive.
- Temporary local verification directories should remain ignored and be cleaned or moved outside the repo after review.

## 8. Backend Findings

Live server wiring:

- Static/app routes: `/`, `/app`, `/app/:asset`, `/app/data/:asset`, `/app/assets/*`, `/app/active-assets/*`, `/app/spiritkin-videos/*`, `/app/game-theme-assets/*`, `/app/game-concept-assets/*`, `/app/premium-game-assets/*`, `/generated-spiritkins/*`, `/portraits/:filename`, `/videos/:filename`, `/world-art/:filename`.
- Legacy routes live in `server.mjs`: `/runtime/interaction/:userId`, `/runtime/spirit/:userId`, `/runtime/conversation/bootstrap`, `/runtime/context/:conversation_id`, `/runtime/episodes/:conversation_id`, `/v0/message`, `/v0/health`, `/v0/conversations`, `/v0/world_state/:conversation_id`, `/v0/memory/list/:conversation_id`, `/v0/memory/pin`.
- v1 registered routes: `/v1/interact`, `/v1/spiritkins`, `/v1/conversations`, `/v1/admin/*`, `/v1/feedback`, `/v1/analytics/*`, `/v1/issues/report`, `/v1/session/*`, `/v1/spiritcore/welcome`, `/v1/games/*`, `/v1/veil-crossing/*`, `/v1/bond-journal`, `/v1/spiritverse/events/*`, `/v1/quests/daily*`, `/v1/speech`, `/v1/spiritkin/generate`, `/health`, `/ready`, `/metrics`.
- Unregistered route modules: `src/routes/entitlements.mjs`, `src/routes/memory.mjs`, `src/routes/world.mjs`.

Route risks:

- v1 routes are not consistently schema-validated. `interact`, `session`, and some analytics paths have schemas; games, speech, generator, and several admin operations need stricter schemas.
- Response formats vary between `{ ok, error, message }`, direct route returns, binary audio, static HTML/assets, and legacy shapes.
- Admin generator endpoints are powerful and correctly guarded by `requireAdminAccess`, but production must force `ADMIN_AUTH_MODE=enforce` with a dedicated `ADMIN_API_KEY`.
- `/v1/spiritkin/generate` directly calls OpenAI via `fetch` inside `server.mjs`, bypassing the adapter registry and central timeout/retry patterns.
- `/v1/speech` uses active OpenAI adapter TTS but is not orchestrator-governed and should have stronger cost and privacy controls.

## 9. Frontend Findings

- `performRender()` replaces the whole app root and remounts most DOM on each render.
- Game board preservation exists through `_lastRenderedActiveGameSignature` and child-node replacement, reducing but not eliminating remount risk.
- There are many direct `render()` calls across click handlers, async flows, voice lifecycle, games, bond manager, PWA install events, and presence lifecycle.
- Voice UI updates use `shouldRenderVoiceUiUpdate()` guards, but interim transcript updates still set `state.input`, `state.voiceTranscriptPreview`, and can render frequently.
- Presence lifecycle throttles interactions at 1200ms and renders only when a check-in appears, but presence remains local state and can still affect full-app render.
- Tab switching goes through `transitionPresenceSurface()`, which is good, but greeting and speak-on-bond paths still need regression tests to guarantee greetings do not repeat.
- Mobile risk areas: games tab while wake/listening is armed, scroll locking around modals, large game boards, and full-root rebuilds while video/audio states are active.

## 10. SpiritCore Authority Findings

SpiritCore-governed:

- `/v1/interact` is the authoritative path. It uses identityGovernor, safetyGovernor, contextService, memoryService, structuredMemoryService, episodeService, emotionService, engagementEngine, spiritCoreAdaptiveService, responseEngine, world state, and sessionControlService.
- Game moves call the orchestrator for Spiritkin commentary and move extraction/fallback.
- Session snapshots can include SpiritCore adaptive envelope data.

Partially governed or bypassing:

- `/v1/spiritcore/welcome` is a service route, not the full orchestrator.
- Quests, events, veil crossing, bond journal, return check-ins, tab narration, and most bond manager flows are service/frontend-driven.
- TTS is adapter-backed but not orchestrator-governed.
- Legacy `/runtime/*` and `/v0/*` paths bypass the current authority model.
- Frontend local storage controls primary Spiritkin, entry state, presence, telemetry, PWA install state, voice mode, and several bond/game UI flags.

Authority assessment:

SpiritCore is strong enough for internal QA and a controlled closed beta after cleanup, but not clean enough yet for premium Spiritkins or Runway media generation at scale. Runway will need an explicit media job authority model tied to Spiritkin identity, consent, prompts, source images, output slots, audit logs, retries, and moderation.

## 11. Voice/Wake Findings

- Mic does not auto-start in the audited code path. `shouldKeepVoiceLoopActive()` returns `false`, and auto listening sources are suppressed.
- Voice modes are `off`, `manual`, and `wake`; wake mode arms but stays paused until intentional mic start.
- Verbal shutdown commands are locally intercepted: "stop listening", "turn off mic", "mic off", "pause wake mode", and similar.
- Speech recognition is browser Web Speech API based and foreground-only; background wake is not possible in a web/PWA implementation.
- Pagehide, hidden visibility, blur, and focus handlers clean up recognition and preserve resume hints.
- TTS playback stops recognition before audio playback and has request-id/fingerprint dedupe protections.
- Privacy UX exists but should be strengthened with explicit microphone, transcript, retention, and memory disclosure before beta.

## 12. Games Findings

- Backend supports list/start/move/draw/state/end.
- `node --check spiritkins-app/spiritverse-games.js` passed.
- Game start and move routes persist active game state into `world_state.flags.active_game`.
- Game move calls orchestrator for commentary, then extracts or falls back to a Spiritkin move.
- Frontend renders boards through `SpiritverseGames.render()` and only mounts active boards after render scheduling.
- Stale rehydration protection exists through active game normalization and render signatures.
- Game visuals are functional but still placeholder-heavy and need a design-system refresh before public beta.
- Games should defer premium themed video/animated board polish to the Runway/game-theme phase, but functional board QA should happen before Runway.

## 13. PWA/Mobile Findings

- Manifest has `start_url: /app/`, `scope: /app/`, `display: standalone`, and basic icons/screenshots.
- Service worker registers at `/app/sw.js` with `/app/` scope.
- Cache strategy is network-first with fallback cache for app shell paths.
- Cache name `spiritkins-shell-v1` is static and not tied to `SPIRITVERSE_APP_BUILD`, creating stale build risk.
- Icons and splash paths should be verified; final beta should include maskable icons and real branded splash assets.
- Mobile viewport includes `viewport-fit=cover`; CSS should still be manually checked for safe-area and fold/tablet layouts.
- PWA cannot support background wake; native later needs a separate wake/audio/session lifecycle design.

## 14. Asset/Media Findings

- `Spiritverse_MASTER_ASSETS` has a reasonable top-level split: `ACTIVE`, `Game_Themes`, `Spiritkin_Videos`, `ARCHIVE`, and untracked `INCOMING`.
- ACTIVE and Game_Themes contain many live placeholder SVGs and duplicated game-board/room assets.
- `INCOMING/wave-4b-assets` and `ARCHIVE/processed_waves/manus_images_20260419` are untracked and should be reviewed, archived, or promoted intentionally.
- `runtime_data` is untracked and should remain untracked for generated local runtime artifacts.
- Asset diagnostics passed route checks but confirmed 404s for Kairo idle/speaking videos.
- The video manifest references idle, speaking, and emotional videos for Lyra, Raien, Kairo, Elaria, and Thalassar; actual `Spiritkin_Videos` content appears incomplete.
- Missing media should be solved by Runway for premium video slots. Before Runway, the frontend should suppress repeated retries and show stable image/CSS fallbacks.

## 15. Security/Privacy Findings

- `.env` is ignored; `.env.example` is present and does not include real secrets.
- Backend uses Supabase service role key server-side. This is acceptable for a trusted backend but raises blast radius if any backend route is exposed incorrectly.
- CORS defaults to `true` when `CORS_ORIGIN` is unset; production should use an explicit allowlist.
- Admin auth `auto` bypasses locally when no secret exists. Production must enforce admin auth and verify every admin/operator route.
- Mic and transcript handling are local/browser-first, but user-facing disclosures need to explain microphone permissions, transcript sending, TTS generation, memory extraction, and retention.
- Safety governor logs safety events, but compliance-grade crisis handling and user safety escalation copy need a dedicated review.
- Abuse/spam risk is partially handled by rate limiting, but generator/TTS/admin routes need cost-specific limits and audit logs.

## 16. Performance Findings

- `spiritkins-app/app.js` is very large and not bundled/split.
- Full-root rerendering is the largest client performance risk.
- Video fallback/missing media can cause repeated network work if not suppressed consistently.
- Service worker can cache stale shell files across deploys.
- Console logging is high in both backend and frontend.
- Game boards and media sync are carefully guarded, but full-app rerenders during voice/presence/game flows remain mobile CPU/battery risks.
- `ready` took 1608ms in endpoint diagnostics; `/v1/interact` took about 5175ms with OpenAI adapter; `/v1/speech` took about 2108ms. These are acceptable for internal testing but should be monitored.

## 17. Code Organization Findings

- `server.mjs` is too broad: static serving, legacy APIs, v1 registration, TTS, custom generation, and compatibility aliases are all mixed.
- `spiritkins-app/app.js` is too broad: state, render, copy, voice, games, PWA, onboarding, bond manager, presence, and media are coupled.
- Root directory contains many historical reports that obscure production files.
- Temporary verification folders/logs are ignored but still present locally.
- `Spiritverse_MASTER_ASSETS` is mostly organized, but duplicated placeholders and unpromoted incoming assets need a clear lifecycle.

## 18. Testing Gaps

Existing checks:

- `node --check server.mjs` passed.
- `node --check spiritkins-app/app.js` passed.
- `node --check spiritkins-app/spiritverse-games.js` passed.
- `node scripts/endpoint-diagnostics.mjs` passed after elevated execution: 31 pass, 0 fail.
- `node scripts/asset-route-diagnostics.mjs` passed after elevated execution and documented Kairo video 404s.
- `tests/phaseE_validation.mjs`, `scripts/conversation-variety-test.mjs`, and `scripts/game-completion-test.mjs` exist but were not requested as validation commands.

Missing:

- Root `npm test`, `npm run lint`, and `npm run build`.
- Browser smoke tests for boot, entry, bonding, chat, tab switching, voice controls, games, and PWA registration.
- Mobile viewport tests for fold/tablet/phone.
- Route tests for validation failures and admin access.
- Schema verification tests for required tables/columns/indexes.
- Voice/wake lifecycle tests.
- Game mount/remount tests.
- Asset manifest existence tests.

## 19. Runway ML Readiness Assessment

**Runway readiness: No.**

The config already has Runway env placeholders, and the generator/provider architecture has a video-provider concept. The product is not ready to add Runway yet because media slot authority, missing-video fallback policy, retry/job persistence, moderation/consent, output asset promotion, and premium Spiritkin mapping are not yet production-clear.

Required before Runway:

- Finalize media slot schema/contract for generated Spiritkin and canonical Spiritkins.
- Add asset manifest existence validation.
- Define Runway job persistence and admin review states.
- Add cost controls and route-specific rate limits.
- Decide where generated videos live and how they are promoted from runtime/incoming to ACTIVE/Spiritkin_Videos.
- Add privacy copy for image/video generation.

## 20. Recommended Next Implementation Phases

1. Stabilization pass: remove or gate legacy route usage, add route schemas, tighten `/v1/speech`, and add schema diagnostics.
2. Frontend render pass: isolate voice/status/presence updates from full-root render and add game remount tests.
3. Media pass: add asset existence checks, suppress missing video retries, and define stable fallbacks.
4. Testing pass: create `npm test`, endpoint tests, browser smoke tests, and mobile/PWA tests.
5. Security/privacy pass: enforce CORS/admin config, add mic/memory disclosures, and audit service-role exposure.
6. Runway foundation pass: implement job model, review queue, slot mapping, and provider safeguards.

## 21. Quick Wins Under 1 Hour

- Add `"type": "module"` to `spiritkins-app/package.json` after confirming no CommonJS consumers.
- Add `npm test` script that runs syntax checks and endpoint diagnostics.
- Add a schema diagnostic script that selects expected tables/columns without applying migrations.
- Update service worker cache name to include `SPIRITVERSE_APP_BUILD`.
- Add `/v1/speech` text length cap and voice allowlist.
- Add an asset manifest existence check for referenced PWA/media/game assets.
- Move old reports into `docs/reports/` in a later cleanup branch.

## 22. Required Fixes Before Runway

- Media slot and asset lifecycle authority.
- Missing video fallback and retry suppression.
- Generator job persistence/review contract.
- Cost/rate limits for video generation.
- Admin enforcement verification.
- Asset existence diagnostics in CI.
- Privacy disclosures for generated media.

## 23. Required Fixes Before Beta

- Automated smoke tests.
- Route validation coverage.
- Schema alignment verification.
- Explicit production CORS/admin env checks.
- PWA cache versioning.
- Media 404 cleanup or stable fallbacking.
- Voice/memory privacy UX.
- Frontend render remount regression tests.

## 24. Deferred Post-Beta Items

- Full frontend modularization.
- Premium visual design refresh for all games.
- Native background wake mode.
- Advanced analytics dashboards.
- Compliance-grade retention controls and export/delete flows.
- Large-scale load testing and multi-region deployment hardening.

## Validation Results

| Command | Result |
| --- | --- |
| `node --check server.mjs` | Pass |
| `node --check spiritkins-app/app.js` | Pass |
| `node --check spiritkins-app/spiritverse-games.js` | Pass |
| `node scripts/endpoint-diagnostics.mjs` | Initial sandbox run failed with `spawn EPERM`; elevated run passed 31/31, 0 failures |
| `node scripts/asset-route-diagnostics.mjs` | Initial sandbox run failed with `spawn EPERM`; elevated run passed route checks and documented Kairo video 404s |
| `npm test` | Failed: missing script |
| `npm run lint` | Failed: missing script |
| `npm run build` | Failed: missing script |

