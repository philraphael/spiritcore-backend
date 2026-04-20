# Media Authority And Post-Gate Fix Report

## Exact Post-Gate Surface Identified

- The incorrect late media swap was happening on the founder ensemble surface rendered by `buildFounderEnsemblePanel()`.
- This surface appears in the post-gate landing/selection experience and was presenting the wrong 3-face art after the initial correct ensemble art appeared.

## Correct Intended Asset

- Intended authoritative asset: `WORLD_ART.ensemble`
  - `Spiritkins in spiritverse.png`

## Wrong Asset That Was Winning

- Wrong lower-priority asset:
  - `spiritcore-spiritkins-portraits.png`

## Root Cause Of The Overwrite

- The founder ensemble panel was authored backwards:
  - primary source = `spiritcore-spiritkins-portraits.png`
  - fallback source = `Spiritkins in spiritverse.png`
- Because the fallback image is visible first while the primary loads, the user briefly saw the correct full ensemble art and then lost it when the wrong primary finished loading.
- The same structural weakness existed in composite image slots generally: fallbacks were allowed to present immediately even in slots where they should only appear on real primary failure.

## Trailer Issues Found

- Pre-bond reveal trailers for configured founders were still wired, but the reveal stage continued rendering still-art media in the same stage even when a trailer existed.
- That weakened trailer authority and made the reveal surface feel like it was being visually competed with by still art.

## Exact Fixes Applied

- Reversed founder ensemble authority:
  - primary = `Spiritkins in spiritverse.png`
  - fallback = `spiritcore-spiritkins-portraits.png`
- Changed post-gate SpiritCore welcome hero fallback from the 3-face art to the full ensemble world art.
- Added `fallbackMode: "errorOnly"` support to `buildCompositeVisualFrame()` so specific authoritative slots do not expose fallback art unless the primary actually fails.
- Applied error-only fallback handling to:
  - founder ensemble panel
  - SpiritCore welcome hero
  - SpiritGate arrival hero
  - Spiritkin media panels
  - Spiritkin canon panels
- Added slot-level debug logging for authoritative media selections and fallback triggers.
- Suppressed still-art media rendering inside the pre-bond reveal stage when a real intro trailer exists, so the trailer owns that stage.
