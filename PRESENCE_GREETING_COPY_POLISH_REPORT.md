## Presence Greeting Copy Polish

### Repetition Root Cause

The repeated and robotic feeling came from three client-side behaviors:

- return greetings were selected from small pools without strong per-context session throttles
- presence check-ins could be attempted on multiple return signals like focus and visibility
- tab narration existed as an active path, which made presence feel more talkative than intended

The result was too much greeting-like copy during load, return, and tab movement.

### Throttles Added

- session conversation greeting now delivers once per session
- spoken return greetings are gated once per key transition:
  - post-gate return
  - bonded confirmation
  - rebond confirmation
- presence check-in remains max once per return window
- tab-switch narration is now disabled by default unless explicitly enabled through local storage
- presence check-in text only updates when the message actually changes

### Copy Changes

Greeting and presence lines were rewritten to be more restrained:

- `Welcome back. I’m here.`
- `Good to see you again.`
- `Still with you.`
- `Take your time.`
- `We can start when you’re ready.`

Removed the more dramatic or overly sentimental tone, including lines like:

- `I was wondering if you’d come back.`
- heavy mystical phrasing for simple return moments

### UI Stability

- presence check-ins no longer force a rerender if the message is unchanged
- no voice auto-start was reintroduced
- no game-system changes were made

### Diagnostics

- `node --check spiritkins-app/app.js` passed
- `node scripts/endpoint-diagnostics.mjs` passed `31/31`

### Remaining Verification

Live browser verification is still needed for:

- repeated tab switching
- return after inactivity
- confirming that greetings feel natural in the deployed build
