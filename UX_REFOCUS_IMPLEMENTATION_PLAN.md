## Purpose

This pass is a controlled UX refocus, not a broad redesign. The goal is to make the product understandable, centered, and immersive by fixing the smallest set of high-leverage frontend behaviors first.

## Root Cause Buckets

### 1. Viewport Anchoring / Auto-Scroll / Focus Targeting

Root cause:
- The app updates local regions correctly, but it does not consistently move the viewport to the thing the user just caused.
- `scrollThread()` only scrolls inside the thread container and does not guarantee the relevant panel is visible in the page viewport.
- Game starts, panel switches, guided surfaces, and status changes can land below the fold or off-center.

Impact:
- Users feel like actions did not work.
- New content appears “somewhere else.”
- Perceived instability and confusion increase.

Priority:
- Highest

### 2. Fullscreen And Cinematic Gate Sequencing

Root cause:
- SpiritGate already has a video and transition states, but the entry sequence does not fully claim the screen or feel like the single active task.
- The current structure emphasizes reliability, but not enough cinematic focus.

Impact:
- First impression is flatter than intended.
- Entry feels like a panel inside an app rather than crossing into a world.

Priority:
- Highest

### 3. Skip Control During Active Gate Sequence

Root cause:
- Skip behavior exists, but the control is tied to the pre-entry shell and not preserved clearly during the active transition itself.
- Users can lose obvious control during the exact moment they most want it.

Impact:
- Trust drops during media playback.
- Users may feel trapped or uncertain.

Priority:
- Highest

### 4. Layout Stabilization / Anti-Blink / Anti-Reflow

Root cause:
- Several surfaces swap state correctly but still shift visual weight abruptly.
- Panels resize and reflow without enough continuity when mode changes happen.

Impact:
- The app feels more mechanical than intentional.
- Small reflows read as instability.

Priority:
- Medium

### 5. Game Viewport Anchoring And AI Turn Visibility

Root cause:
- Games render correctly, but the product still treats them as one region among many.
- AI turn state is visible, but not always visually centered as the primary event.

Impact:
- The game can feel like a side widget instead of a deliberate mode.
- Users can miss when the board changes or where to look.

Priority:
- Highest

### 6. Modal / Panel Placement And Response Positioning

Root cause:
- Important guided interactions and response surfaces are still embedded inline.
- Some actions deserve a centered overlay to establish “this is the current task.”

Impact:
- Interaction context feels scattered.
- Important moments compete with background layout.

Priority:
- Medium

### 7. Product Clarity And First-Loop Guidance

Root cause:
- The product contains multiple strong systems, but the first loop is not explicit enough about what to do now and why to stay.
- Guidance is present in pieces, but not concentrated into one clear orientation layer.

Impact:
- Users may not understand the value loop quickly enough.
- Retention and immersion suffer in the first minutes.

Priority:
- Highest

### 8. Information Hierarchy And Crowding Reduction

Root cause:
- Conversation, profile, progression, and side systems often compete at equal visual strength.
- The current layout is capable, but the primary action is not always the strongest object on screen.

Impact:
- Attention diffuses.
- The experience feels busier than it needs to.

Priority:
- Medium

## Highest-Leverage Implementation Order

### Tranche 1: Implement Now

1. Viewport anchoring system
2. Fullscreen SpiritGate with persistent Skip Intro during active sequence
3. Active game focus mode with stronger board centering
4. Lightweight first-loop clarity layer

Reason:
- These four fixes share the same underlying problem: the user is not always visually guided to the current primary task.
- They improve understanding, perceived quality, immersion, and trust without backend changes or broad redesign.

### Tranche 2: Plan Next, Do Not Implement In This Pass

1. Centered modal treatment for selected guided / response flows
2. Broader anti-reflow and layout stabilization
3. Stronger hierarchy cleanup across profile / side systems

Reason:
- These are valuable, but they are wider in scope and easier to overdo.
- They should happen after the focus and anchoring layer is stable.

## Implementation Scope For This Pass

### A. Viewport Anchoring

Planned changes:
- Add a small frontend-only scroll targeting helper based on `scrollIntoView({ behavior: "smooth", block: "center" })`.
- Anchor to the active game panel when a game starts or updates.
- Anchor to the conversation stage or newest assistant response after message flow changes.
- Anchor to guided or focus panels when a mode switch makes them primary.

Success signal:
- The user does not need to manually hunt for the result of their last action.

### B. SpiritGate Focus

Planned changes:
- Attempt fullscreen on deliberate entry where supported.
- Keep the gate visually dominant during active playback / transition.
- Preserve a visible `Skip Intro` control while the gate is active.

Success signal:
- Entering the SpiritVerse feels like a single focused sequence, not a page with background video.

### C. Game Focus Mode

Planned changes:
- When a game is active, visually promote the game panel and reduce the sense that it is competing with surrounding UI.
- Ensure the board is centered into view after start and important updates.

Success signal:
- A live game feels like the main thing happening.

### D. Product Clarity Layer

Planned changes:
- Add a lightweight guidance card for the first active bonded loop:
  - talk to your Spiritkin
  - play games
  - grow your bond
- Keep this subtle and non-blocking.

Success signal:
- Users immediately understand the core loop and the next useful actions.

## Explicit Deferrals

Not part of this pass:
- backend changes
- new content systems
- full information architecture rewrite
- broad modal conversion of every panel
- major visual redesign

## Verification Checklist

1. Trigger an action and confirm the result is centered in view.
2. Start a game and confirm the board becomes the primary visible target.
3. Enter SpiritGate and confirm fullscreen is attempted where supported.
4. Confirm `Skip Intro` remains visible during active gate playback.
5. Enter bonded mode and confirm the first-loop guidance is obvious but not intrusive.
