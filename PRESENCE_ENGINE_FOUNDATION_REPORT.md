## Presence Engine Foundation

### What Was Added

A lightweight client-side presence layer was added to `spiritkins-app/app.js`.

It introduces a local presence state:

- `lastSeenAt`
- `lastInteractionAt`
- `lastEmotion`
- `idleDuration`
- `engagementScore`

The state is stored locally under `sv.presence_engine.v1` and does not require any backend or schema changes.

### Presence Behavior

The presence engine now passively tracks:

- page focus / blur
- visibility changes
- real user interaction events
- time away before return

It does not auto-start voice, does not open modals, and does not force recurring rerenders.

When the user returns after a meaningful idle window of roughly 5 to 30 minutes, the client can surface one subtle check-in for that session.

### Emotional Memory Hook

The presence layer remembers the most recent assistant emotional tone from the local session history and uses it to shape the next return check-in.

Examples:

- `You seemed overwhelmed earlier… how are you now?`
- `You felt tired earlier… I’m here with you now.`
- `Hey… I was wondering if you’d come back.`
- `Hey… welcome back. I’m still here.`

### UI Integration

Presence is shown in non-intrusive places only:

- a small topbar presence status chip
- the existing in-app status bar area when a return check-in is active

No modal, popup, or voice action is triggered.

### Safety

- no auto mic start
- no wake loop
- no backend dependency
- no schema change
- no game-system modification
- check-ins are throttled to at most once per session return
- interaction tracking updates local state without forcing render churn

### Verification

- `node --check spiritkins-app/app.js` passed
- `node scripts/endpoint-diagnostics.mjs` passed `31/31`

### Remaining Limits

Real browser validation is still needed for:

- the exact feel of the return check-in timing
- confirmation that the subtle presence note feels natural on mobile and desktop
