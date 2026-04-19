# Lost Polish Regression Report

Date: 2026-04-19

Objective:
- Identify where the current runtime appears structurally safe but less premium than intended.
- Focus on regressions likely introduced by recovery, recreated files, fallback-heavy stabilization, or earlier UX layers not being reattached.

## 1. Entry Behavior

Current behavior:
- Entry flow is heavily guarded by SpiritGate fallback timers, playback safety timers, skip logic, and render-time state gates.
- The code contains multiple explicit failsafe transition paths for gate video and arrival trailer handling:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:2757)
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:2783)
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:2799)

Likely richer intended behavior:
- A more cinematic handoff with fewer visible safety cues and less sense that the system is bracing for failure.

Likely regression source:
- Fallback-heavy safety logic added during stabilization to prevent blank states and dead transitions.

Assessment:
- Structurally safer.
- Less premium and more operational than experiential.

## 2. Media Continuity

Current behavior:
- Media logic is conservative and state-protective.
- The app prioritizes not breaking over feeling seamless.
- The latest gate fixes improved restart behavior, but the media system still reads as defensive.

Likely richer intended behavior:
- Entry video, trailer, and audio would feel like a guided sequence instead of a guarded state machine.

Likely regression source:
- Recovery and stabilization hardening.

Assessment:
- Not broken.
- Still feels safety-first.

## 3. Greetings and Returning Presence

Current behavior:
- Returning greeting repetition had to be patched via local recent-history avoidance.
- The current solution is lightweight and local, not deep continuity.

Likely richer intended behavior:
- Returning entry should feel memory-shaped and relational, not just “pick a different greeting line.”

Likely regression source:
- Missing reattachment of a richer continuity layer during recovery, plus fallback defaults overpowering contextual greeting selection.

Assessment:
- The current patch removes obvious repetition.
- Premium continuity is still thinner than ideal.

## 4. Game Polish

Current behavior:
- Most games render with CSS or placeholder art fallback assets.
- The asset manifest explicitly marks many game assets as placeholders or planned, not final:
  - [spiritkins-app/data/gameAssetManifest.js](/abs/path/C:/spiritcore-backend/spiritkins-app/data/gameAssetManifest.js:1)
- The in-page game boards often act like previews while Grand Stage is the real interaction surface.

Likely richer intended behavior:
- Inline boards should feel genuinely playable and premium without requiring expansion.
- More final art and less visible reliance on placeholders or runtime fallback renderers.

Likely regression source:
- Combination of recovery prioritizing functionality and unfinished art integration.

Assessment:
- This is the clearest “works, but does not feel premium” area.

## 5. Voice Interaction

Current behavior:
- Manual mic works in the conversation composer.
- The smoother auto-loop for game turns is effectively disabled:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:5376)

Likely richer intended behavior:
- Continuous voice mode would feel more ambient and less manually re-triggered.

Likely regression source:
- Earlier voice-loop or game-turn reattachment was probably disabled during stabilization to avoid race conditions and stuck-listening states.

Assessment:
- Safety won over flow.

## 6. Loading and Feedback

Current behavior:
- The app has more spinners, loading labels, status bars, and defensive messaging than a premium final UX would normally expose.
- There is also a visible games boot fallback path in case the games module fails:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:74)

Likely richer intended behavior:
- Fewer “system is recovering” cues and more seamless motion, reveal, and confidence.

Likely regression source:
- Recovery and stabilization emphasis.

Assessment:
- Functionally useful.
- Premium feel is reduced.

## 7. Discoverability

Current behavior:
- Some critical behaviors are technically present but not obvious:
  - voice mode is separate from the mic button
  - most game boards need Grand Stage for real interaction
  - placeholder or runtime-fallback art is hidden behind visually complete surfaces

Likely richer intended behavior:
- The primary visible surface should also be the primary usable surface.

Likely regression source:
- Missing reattachment of prior interaction affordances and premium asset passes.

## Consolidated Regression Truth

Actually lost or reduced:
- seamless game interaction in the main page
- some higher-confidence voice continuity behavior
- richer media handoff feel
- premium art and board finish in several games

Probably not “lost,” just still unfinished:
- final game asset package
- deeper returning-user continuity memory for entry greetings

Most likely caused by stabilization:
- fallback timers and guarded transitions
- conservative speech handling
- safe status-driven UX replacing richer sequencing
