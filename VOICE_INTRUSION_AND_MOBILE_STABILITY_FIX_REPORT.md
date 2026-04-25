## Voice Intrusion And Mobile Stability Fix

### Root Cause

The frontend still had several auto-voice paths active even after earlier wake-mode stabilization:

- wake/session defaults could arm voice on their own
- focus and visibility handlers tried to resume wake listening automatically
- the voice continuity loop could restart listening after reply playback
- transcript/interim voice updates always called `render()`, including while the Games surface was active

That combination made mobile feel intrusive and could still disturb scrolling, board access, and overall UI stability.

### Voice Behavior Changes

- Default voice mode is now explicit and non-intrusive:
  - `off`
  - `manual`
  - `wake`
- The app no longer auto-starts listening on:
  - boot
  - session default sync
  - gate return
  - focus/visibility return
  - unmute
  - game auto-turn
- Manual mode now means exactly manual: the mic stays off until the user taps it.
- Wake mode is now armed-but-paused by default and does not begin listening until the user taps the mic.
- The old continuous reply-to-reply auto-turn loop is disabled.

### Verbal Off Commands Added

These commands are intercepted locally and are not sent to SpiritCore:

- `stop listening`
- `turn off mic`
- `mic off`
- `pause wake mode`
- `stop wake mode`
- `go quiet`
- `be quiet for now`

When detected, the client:

- stops recognition immediately
- clears pending transcript state
- sets voice mode to `off`
- pauses wake mode
- shows the confirmation:
  - `I’ll stay quiet until you turn me back on.`

### Mobile Behavior

- Entering Games on mobile pauses wake listening instead of trying to keep it live in the background.
- Voice-only UI updates are suppressed while a game is active, which prevents transcript churn from forcing unnecessary rerenders into the Games surface.
- Wake no longer tries to auto-resume on focus or visibility changes.

### Missing Video Stability

The existing session-level Spiritkin video failure memory remains in place, so missing clips continue to fall back to still imagery instead of retrying endlessly during the same session.

### Validation

- `node --check spiritkins-app/app.js`
- `node --check spiritkins-app/spiritverse-games.js`
- `node scripts/endpoint-diagnostics.mjs`

### Remaining Limits

- Real browser/mobile verification is still required for:
  - no listening auto-start on live load
  - verbal shutoff command behavior in an actual microphone session
  - final confirmation that console chatter is reduced on the deployed build
