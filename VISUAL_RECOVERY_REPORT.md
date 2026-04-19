## Broken Replacements Reverted

1. Reverted the Spiritkin/media remap in `spiritkins-app/app.js` that replaced the working portrait and world-art surfaces with the newer ACTIVE media overrides.
2. Reverted the chess/checkers direct-image runtime replacement in `spiritkins-app/spiritverse-games.js` and `spiritkins-app/spiritverse-games.css` back to the prior stable inline/SVG and CSS rendering path.
3. Reverted the aggressive manifest remap in `spiritkins-app/data/gameAssetManifest.js` so chess/checkers/go/battleship stop depending on the failed primary replacements from the last pass.

## Spiritkin / Media Surfaces Restored

1. Founder selection now uses the previous working world-art ensemble panel again.
2. Spiritkin preview, focus, bonded portrait, and mini portrait surfaces now use the prior `/portraits/...` portrait path again.
3. Welcome / open-close media was restored to the prior stable gate poster and entry presentation instead of the newer replacement images.

## Board / Theme Paths Fixed

1. Restored the previous game renderer path for chess and checkers so board rendering no longer depends on the failed direct PNG piece swap.
2. Preserved the prior manifest structure and explicitly shipped the board, room, concept, and UI assets that those restored manifests already reference.
3. This fixes the production mismatch where manifests referenced local ACTIVE PNG assets that existed in the workspace but were not present in git for deploy.

## Support-Only Assets

1. The newer Manus Spiritkin media assets remain in ACTIVE but are no longer forced as the primary portrait layer.
2. The newer isolated chess/checkers piece PNGs remain in ACTIVE, but are no longer the primary runtime rendering path.
3. The newer welcome / SpiritCore media assets remain available for later refinement, but are not the active primary surfaces in this hotfix.

## Later Refinement Still Needed

1. If the Manus Spiritkin media is reintroduced later, it should be wired deliberately per surface instead of replacing the shared portrait path globally.
2. If premium chess/checkers piece images are reintroduced later, they need a dedicated verified layout pass instead of replacing the stable renderer wholesale.
3. ACTIVE runtime assets should be audited so future manifests do not reference files that are present locally but missing from git/deploy.
