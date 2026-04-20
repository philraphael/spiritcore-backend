## Spiritkin image fixes

- Restored Elaria and Thalassar to canonical runtime-served ACTIVE assets instead of the older `world-art` fallback path.
- Verified the runtime files exist:
  - `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria.png`
  - `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/thalassar.png`
  - `Spiritverse_MASTER_ASSETS/ACTIVE/concepts/Elaria Left Thalassar right.png`
- Updated both composite media panels and portrait lookups so these two founders no longer depend on missing or inconsistent fallback media.
- Result: Elaria and Thalassar now resolve through `/app/active-assets/...`, which matches the canonical asset pipeline and the current server route.

## Presence system implementation

- Kept the persistent companion dock in the bonded interaction surface.
- Made the companion dock sticky so the active Spiritkin remains visibly present while the thread scrolls.
- Made the left presence panel sticky with bounded height and internal scrolling so profile, games, and bonded navigation remain visible instead of drifting off-screen.

## Board rendering fixes

- Reduced the dark generic overlay on `.game-board-container::before` and raised board-art visibility so the themed board image reads as the primary surface.
- Reduced generic fill on shared mini-board cells so TicTacToe, Connect Four, and similar boards stop looking like plain dark grids.
- Applied board art to Go preview rather than a plain flat tan background.
- Lowered Connect Four cell darkness so the active board art reads more strongly through the runtime layer.

## Layout corrections

- Locked the left presence column with sticky positioning and bounded overflow.
- Added contained overscroll handling to the tab content so panel scrolling feels intentional and does not clip as easily.
- Added thread scroll padding so focused content does not jump under the sticky companion region.

## Speech duplication fix

- Root cause: normal assistant reply autoplay was calling `speakMessage(...)` directly from `sendMessage(...)`, bypassing the existing `maybeSpeakMessageLater(...)` scheduler and dedupe guard used elsewhere.
- Fix: routed normal reply autoplay through `maybeSpeakMessageLater(...)` so one assistant turn only schedules one speech lifecycle.
- Result: replay/manual audio controls remain intact, while normal browser reply playback now follows the single authoritative scheduler.

## Remaining issues

- The app still retains emergency portrait SVG fallback behavior if a remote image genuinely fails; that is intentional protection, but it should not be the visible path for healthy runtime assets.
- Some game modes still use support-layer styling rather than full true-render board replacement; this pass increased board dominance but did not rewrite game rendering logic.
- The untracked archive folder `Spiritverse_MASTER_ASSETS/ARCHIVE/processed_waves/manus_images_20260419/` remains outside this stabilization scope.
