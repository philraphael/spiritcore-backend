# Bond Manager Foundation Fix Report

## Old Broken Flow
- Bonded users could carry stale bond-selection state into post-gate entry, which made the app feel like it was landing in Manage Bond instead of the bonded room.
- Bond switching still depended on overlapping legacy flags: `selectionOverlaySpiritkin`, `pendingBondSpiritkin`, and `rebondSpiritkin`.
- Clicking alternate Spiritkins from the bonded surface could set state silently before the UI explained what would happen.
- There was no bounded frontend media contract for future premium/custom Spiritkins.

## New State Machine
- `closed`
- `browsing`
- `preview`
- `confirm`
- `switching`
- `complete`

## Default Landing Fix
- Added bonded-entry normalization so `entryAccepted + primarySpiritkin` clears stale bond-manager state on boot, post-gate landing, bonded-room return, and rebond completion.
- Bonded users now default back to the bonded room / presence room state instead of carrying rebond overlay or selection state across entry.
- Stale bonded-manager flags are cleared through one helper instead of separate ad hoc branches.

## Controlled Bond Manager Flow
- `Manage bond` now opens `browsing`.
- Selecting another Spiritkin opens `preview`.
- Preview shows dominant media, current-vs-selected comparison, wake name, domain, and story context.
- `Make Primary Companion` moves to `confirm`.
- `Confirm Switch` moves to `switching`, then the existing bonded transition runs.
- On completion, the flow closes and returns the user to the bonded room with the new active Spiritkin.

## Future Premium / Custom Spiritkin Media Contract
- Added `getSpiritkinMediaProfile(spiritkin)` returning:
  - `id`
  - `name`
  - `displayName`
  - `wakeNames`
  - `domainName`
  - `portrait`
  - `heroImage`
  - `trailerVideo`
  - `idleVideo`
  - `speakingVideo`
  - `storyIntro`
  - `rarityTier`
  - `isCustom`
  - `isPremium`
- The helper is additive and fallback-safe. It uses current canon assets now and leaves a stable contract for future premium/custom media without requiring new assets in this pass.

## Files Changed
- `spiritkins-app/app.js`
- `spiritkins-app/styles.css`

## Verification Result
- `node --check spiritkins-app/app.js` passed.
- `node scripts/endpoint-diagnostics.mjs` passed `31/31`.
- `/v1/interact` remained `200`.

## Remaining Issues
- Live browser verification is still required for the exact UX steps:
  1. bonded user lands in bonded room after gate entry
  2. Manage Bond opens browsing
  3. Kairo -> Lyra preview -> confirm -> switching -> bonded return
  4. Lyra -> Raien repeat flow
  5. no hidden or off-screen controls in the deployed browser build
- This pass does not add new media assets; missing premium/custom media still depend on later asset population.
