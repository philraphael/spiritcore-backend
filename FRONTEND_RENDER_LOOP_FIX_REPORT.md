# Frontend Render Loop Fix Report

## Root Cause

- The frontend still had an uncontrolled state-to-render feedback path even after the earlier wake and shell fixes.
- Two specific loop sources remained:
  - repeated direct `render()` calls in the same tick with full `root.innerHTML` replacement
  - repeated session-control syncs reapplying effectively identical backend session snapshots and then rendering again
- Because the UI rebuild path recreates the app shell, those duplicate renders showed up as:
  - blinking/flicker
  - stacked-looking surfaces
  - asset reload churn
  - repeated interaction/state logs

## Loop Source

### Render Path

- `render()` was still synchronous and directly callable from many branches.
- Multiple state updates in one interaction cycle could therefore trigger repeated full DOM replacement within the same frame window.

### Session-Control Path

- `syncSessionControlSoon()` could queue repeated control writes with no debounce.
- `syncSessionControl()` could reapply a backend snapshot even when the effective UI/session state had not meaningfully changed.

## Fix Applied

### Render Control

- Split rendering into:
  - `performRender()` for the actual DOM replacement work
  - `render()` as a scheduled wrapper
- Added frame-level render coalescing:
  - `_renderScheduled`
  - `_renderRequestedWhileRendering`
  - existing `_isRendering`
  - existing `_renderCycleGuard`
- Result:
  - only one render is scheduled per frame window
  - reentrant render requests are collapsed into at most one follow-up render

### Session-Control Stabilization

- Added session-control in-flight and debounce guards:
  - `_sessionControlSyncInFlight`
  - `_sessionControlSyncPromise`
  - `_sessionControlSyncTimer`
  - `_queuedSessionControlArgs`
  - `_lastSessionControlSignature`
  - `_lastSessionControlAt`
- Added `buildSessionControlPayload()` so duplicate outgoing control payloads can be detected consistently.
- `syncSessionControlSoon()` now debounces instead of blindly queueing Promise microtasks.

### Snapshot Reapply Suppression

- Added `buildSessionStateSignature()` and used it in `applySessionSnapshot()`.
- If the incoming backend snapshot does not materially change the current frontend session state, `applySessionSnapshot()` now returns `false`.
- Callers such as `fetchSessionSnapshot()` and `syncSessionControl()` now render only when the snapshot actually changed state.

## Files Changed

- `spiritkins-app/app.js`
- `spiritkins-app/styles.css` unchanged in this pass

## Validation

- `node --check spiritkins-app/app.js` — passed
- `node scripts/endpoint-diagnostics.mjs` — passed `31/31`
- `/v1/interact` remained `200`

## Verification Result

- The frontend render/state flow is now guarded against same-tick duplicate renders and repeated session-control churn.
- Continuous `state-normalized` spam should no longer be driven by backend snapshot reapplication or same-cycle render storms.
- Live browser confirmation is still required to truthfully verify that production flicker and menu stacking are fully gone after deploy.
