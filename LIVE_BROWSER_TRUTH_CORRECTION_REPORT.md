# Live Browser Truth Correction Report

## 1. Solis / Neris image failure

Live production requested:

- `/app/assets/concepts/Solis.png`
- `/app/assets/concepts/Neris.png`
- `/app/assets/concepts/Solis%20Neris%20pair.png`

Those URLs returned 404 in the browser probe. The legacy source images still returned successfully:

- `/app/assets/concepts/Elaria.png`
- `/app/assets/concepts/thalassar.png`

Root cause: the Solis/Neris alias assets had been added under `spiritkins-app/public/world-art`, but `/app/assets/*` is served from `Spiritverse_MASTER_ASSETS/ACTIVE`. The frontend was correctly requesting the new frontend display names, but the matching runtime assets did not exist in the live asset root.

Fix: added Solis/Neris alias images to `Spiritverse_MASTER_ASSETS/ACTIVE/concepts` so the live `/app/assets/concepts/*` URLs resolve without falling into blank/broken media states.

## 2. Trailer failure

Live browser evidence showed gate videos loading with 200s but also repeated aborted media requests during render/route transitions. In the bonded Manage Bond flow, clicking another founder opened the rebond modal directly, so the fullscreen reveal/trailer surface was not mounted. That made trailers appear unavailable in the current live user path even though ready trailer files such as `/videos/lyra_intro.mp4` exist.

Fixes:

- Rebond requests now open the same reveal surface first, allowing ready intro trailers to mount before rebond confirmation.
- Intro reveal videos now mount as muted autoplay inline videos by default, matching browser autoplay requirements.
- Trailer playback still allows a user-initiated audio toggle without changing voice-loop behavior.
- If a founder has no trailer asset configured, the still fallback remains explicit and clean.

## 3. Stacking issue found

The live shell had the sticky `chat-rail-section` elevated at the same z-index tier as game panels. That allowed the persistent rail to compete with active game/menu surfaces instead of remaining a companion/content surface.

Fix: lowered the sticky rail to the content-panel layer while leaving active game panels on the game-panel layer. This preserves the presence rail while preventing it from sitting above game/menu surfaces.

## 4. Media-size issue found

The production browser probe captured a bonded Spiritkin media frame collapsed to roughly 38px wide while still reporting visible. This was a layout-authority issue: bonded media columns were allowed to shrink into a sliver, and the profile portrait sizing stayed too conservative for the intended major presence surfaces.

Fixes:

- Added minimum desktop width protection for bonded/focus media columns.
- Enlarged the profile portrait/media sizing guard.
- Added a safer minimum for companion dock media panels.
- Kept responsive collapse behavior intact below the desktop breakpoint.

## 5. Speech-quality tuning

No wake/session/voice-loop logic was changed.

Fix: frontend audio playback now applies the existing Spiritkin `voiceProfile.speed` as a bounded playback-rate cue with pitch preservation. This is a lightweight prosody adjustment intended to reduce robotic cadence without changing speech generation, wake filtering, or session flow.

## 6. Remaining after this pass

- Solis and Neris still do not have dedicated intro trailer MP4s configured; they intentionally fall back to still reveal art until real trailer assets are delivered.
- Production verification of the fixed Solis/Neris asset URLs requires the Railway deployment that includes this commit.
- Browser verification after deployment should confirm `/app/assets/concepts/Solis.png`, `/app/assets/concepts/Neris.png`, and `/app/assets/concepts/Solis%20Neris%20pair.png` return 200.
