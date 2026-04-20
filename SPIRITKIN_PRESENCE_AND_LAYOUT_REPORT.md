# Spiritkin Presence And Layout Report

## 1. Persistent Spiritkin presence added/fixed

- Restored Elaria and Thalassar to their original working visual sources in `spiritkins-app/public/world-art`:
  - `Elaria.png`
  - `thalassar.png`
  - `Elaria Left Thalassar right.png`
- Updated the frontend runtime so Elaria and Thalassar no longer depend on the later remapped ACTIVE concept copies for their primary on-screen presence.
- Added a persistent companion dock inside the bonded conversation/game screen so the active Spiritkin remains visibly present even when the side panel is scrolled or visually secondary.
- The dock uses the current Spiritkin image panel plus portrait treatment, keeping the companion visually anchored during conversation and game flow.

## 2. Light motion added

- Added subtle floating motion to active Spiritkin panels.
- Added gentle breathing-scale motion to loaded portrait images.
- Kept motion intentionally light so it reads as alive rather than decorative or distracting.

## 3. Speaking-state cue added

- Added a lightweight speaking aura on the portrait/media panel when Spiritkin speech is active.
- Updated bonded chat status text so the header distinguishes:
  - present
  - responding
  - speaking

## 4. Layout and tab issues fixed

- Fixed the first-page founder card grid misalignment:
  - the layout was styled as a three-column grid while rendering only two content blocks
  - it now uses a correct two-column structure
- Adjusted the entry gallery to align from the top instead of centering awkwardly.
- Improved bonded layout stability:
  - `presence-panel` and `chat-stage` now explicitly allow shrinkage inside grid layout
  - reduced clipping risk for panel content
- Improved header/menu resilience:
  - `presence-panel-head` and `chat-header-right` now wrap cleanly instead of clipping
- Improved presence tabs:
  - tabs wrap on larger layouts instead of getting chopped
  - tabs fall back to horizontal scroll on smaller viewports
- Added responsive handling for the new companion dock on smaller screens.

## 5. Board theme visibility tuning

- Increased themed board dominance by strengthening board-art visibility in the active game board layer.
- Reduced the remaining generic visual weight so themed art reads more clearly without harming move clarity.

## 6. What still needs future Spiritkin loop/video assets

- Elaria and Thalassar now have their original still-image presence back, but they still do not have dedicated animated loop or open/close media pairs comparable to the stronger Lyra/Raien/Kairo shell assets.
- Speaking-state presentation is still aura-based only; no true facial or mouth animation is present.
- A future pass would benefit from:
  - dedicated loop/idling clips for Elaria
  - dedicated loop/idling clips for Thalassar
  - cleaner speaking-state media variants for all founders
