# SPIRITCORE PRESENCE + ADAPTIVE COMMUNICATION FOUNDATIONS REPORT

## 1. Presence upgrades made

- Extended the persistent bonded Spiritkin dock so it now appears in the bonded-home support rail as well as the active conversation rail.
- Preserved the current room-based shell and presence/media architecture instead of introducing a second presence system.
- Added a larger `bonded-home` dock variant so the bonded Spiritkin remains visibly present and does not collapse into a tiny utility card while navigating the bonded world shell.

## 2. Speaking / listening state changes

- Extended Spiritkin visual presence states to include:
  - `idle`
  - `listening`
  - `speaking`
  - `attentive`
  - `reflective`
  - `game-focused`
- Updated the Spiritkin video manifest to support `listening` as a safe alias path that falls back through `attentive` to `idle` when dedicated media is not available.
- Added subtle listening-state visual treatment for portrait/media surfaces and the presence dock without introducing a heavy animation system.
- Kept speaking, listening, and fallback behavior inside the existing media/presence layer.

## 3. Communication-style model design

- Built on the existing adaptive profile instead of replacing it.
- Added a bounded `styleModel` with:
  - `formality`
  - `casualness`
  - `emotionalHeaviness`
  - `directness`
  - `verbosity`
  - `playfulness`
- Added a bounded `styleMemory` with explainable preference flags:
  - `prefersConciseReplies`
  - `prefersPlayfulTone`
  - `prefersWarmth`
  - `prefersStructuredClarity`
  - `usesCasualLanguage`
  - `prefersDirectness`
- Adaptation remains explicitly limited to communication style and conversational behavior.
- No demographic inference logic was introduced.

## 4. Memory / profile behavior added

- The frontend adaptive profile now retains the new style dimensions and preference flags locally.
- The backend SpiritCore adaptive service now normalizes, merges, and persists those fields into the stored `spiritcore_adaptive_profile`.
- Structured-memory preferences and corrections can now reinforce style-profile tendencies in a bounded way.
- The adapter prompt layer now receives an explainable style summary rather than opaque adaptation.

## 5. Ambient integration foundation created

- Added `src/services/spiritCoreAmbientService.mjs`.
- This service emits a descriptive ambient foundation object for future:
  - light color / mood signals
  - environment scene states
  - hospitality / cinema modes
- The ambient foundation is descriptive only.
- No device control, smart-home execution, or environment actuation is performed in this pass.
- The resulting `spiritcore_ambient_foundation` state is now available in world flags for future integrations.

## 6. What should come next before true Alexa-like background mode

- Add explicit user consent and device authorization flows for any future ambient or real-world environment control.
- Introduce a dedicated background-presence runtime with clear session ownership, pause/resume rules, and wake-word boundaries.
- Add a stable ambient policy/governor so future environment outputs cannot conflict with safety, sleep, privacy, or user focus.
- Expand Spiritkin media inventory for `listening`, `attentive`, and `reflective` states so more presence transitions can use authored assets instead of safe fallbacks.
- Add browser/device verification harnesses for ever-present Spiritkin behavior across room transitions, voice capture, and game surfaces.
