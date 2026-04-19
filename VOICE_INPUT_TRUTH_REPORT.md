# Voice Input Truth Report

Date: 2026-04-19

Scope:
- Reviewed the current microphone input path in [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:8032), the chat composer UI in [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:7071), and related voice mode state handling.
- This report is specifically about user speech input, not TTS or replay.

## Classification

Overall classification: `partially working`

Secondary classifications:
- `hidden/discoverability failure` in some flows
- `browser-dependent implementation`
- `lost continuity behavior in games`

## Truth Findings

### 1. UI Exposure

Current truth:
- The bonded conversation surface exposes a dedicated mic button in the composer:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:7082)
- There is also a separate “Enable Voice” control in the header for continuous voice mode:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:6945)

Assessment:
- The mic path is not absent.
- It is visible once the user is in the bonded conversation surface.
- It is not clearly discoverable before that point, and there is no dedicated microphone onboarding beyond the generic entry consent copy.

### 2. Permission Flow

Current truth:
- There is no explicit `getUserMedia()` permission preflight.
- The app relies on the browser’s SpeechRecognition or webkitSpeechRecognition API:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:8034)

Assessment:
- Permission handling is implicit and browser-controlled.
- This is workable in Chrome-family browsers, but fragile as a product assumption.
- There is no richer permission UX, device selection, or fallback guidance beyond a status message.

### 3. Recognition Mounting

Current truth:
- Recognition is actively mounted and started inside `startListening()`.
- It sets lifecycle state on `onstart`, `onresult`, `onerror`, and `onend`.
- Final transcript is inserted into `state.input` and then routed through the normal conversation send path:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:8085)
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:8113)

Assessment:
- The frontend input path is real, not stubbed.
- Recognized speech does enter the actual interaction flow.

### 4. Conversation Integration

Current truth:
- Final recognized speech calls `sendMessage(transcript)`.
- Duplicate protection exists via `_lastVoiceSubmission`.
- Speech lifecycle updates also synchronize session-control speech state.

Assessment:
- This is a real wired path, not cosmetic.
- The main interaction handoff from recognition to chat is present.

### 5. What Was Lost or Never Reattached

Current truth:
- `maybeAutoOpenGameMic()` immediately returns and never executes its intended auto-open behavior:
  - [spiritkins-app/app.js](/abs/path/C:/spiritcore-backend/spiritkins-app/app.js:5376)
- That means the intended smoother game-turn microphone continuity is disabled in current runtime.

Assessment:
- This is strong evidence of a previously intended polish layer being effectively detached.
- Voice input still works manually, but the richer hands-free flow is not currently active.

## What Is Actually Broken

- Automatic game-turn voice capture is functionally disabled by an unconditional early return.
- Voice input is browser-specific and not productized beyond SpeechRecognition support.

## What Is Not Broken

- Manual mic entry in bonded conversation.
- Final transcript routing into the real send flow.
- Recognition lifecycle event handling.

## Final Classification Notes

`fully working` would require:
- reliable discoverability
- explicit permission clarity
- consistent cross-surface behavior
- the intended continuous loop behavior actually enabled where designed

Current runtime does not meet that bar.
