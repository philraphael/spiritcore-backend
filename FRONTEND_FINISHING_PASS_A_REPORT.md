# Frontend Finishing Pass A Report

## 1. What Grand Stage Mapping Changed

- Grand Stage room background authority was tightened in `spiritkins-app/spiritverse-games.js`.
- The `crown` environment no longer uses the generic `Spiritverse background base theme.png` fallback as its primary room surface.
- `crown` now points at SpiritCore-specific media instead of the generic room background.
- `archive` no longer reuses the mixed Elaria/Thalassar composite as support art.
- `abyssal` no longer reuses the mixed Elaria/Thalassar composite as support art.
- Grand Stage header now includes the active chamber/domain label so the fullscreen surface explicitly names the active chamber.

## 2. What Theme/Room/Board Mappings Changed

- `spirit_cards` now uses the `archive` board variant instead of `crown`.
- `tictactoe` now uses the `archive` board variant instead of `crown`.
- This aligns Elaria-authored games with Elaria archive styling instead of the more generic crown surface.
- Room art remains domain-led through `resolveThemeEnvironmentOverrides(...)`.
- Board environment remains tied to the active theme through `--game-board-art` and the existing board asset package.
- Accent/support styling was pushed toward theme tinting and framing rather than competing image collage layers.

## 3. Which Weak Background/Fallback Layers Were Removed Or Reduced

- Removed the generic Spiritverse base background from the `crown` room override path.
- Removed the mixed Elaria/Thalassar composite from `archive` accent mapping.
- Removed the mixed Elaria/Thalassar composite from `abyssal` accent mapping.
- Reduced shell overlay intensity in `spiritverse-games.css` so room art dominates more clearly.
- Removed accent-image competition from `.sv-theme-shell::after`.
- Removed accent-image competition from `.game-fullscreen-overlay::before`.
- Reduced the heaviness of the board-stage overlay so the chamber and board art stay legible without flattening into a collage.
- Shifted the fullscreen sidebar toward a glass/dim support treatment so it stops competing with the stage.

## 4. What Still Remains For Pass B And Pass C

- Pass B should refine chamber-specific art direction further where current domain assets still rely on repurposed images rather than purpose-built room environments.
- Pass B should unify remaining game naming, chamber copy, and any legacy labels so every board/game reads as one coherent domain surface.
- Pass C should handle deeper cinematic polish, motion hierarchy, and panoramic progression once the authoritative room stack is fully stable.
- Pass C can also revisit any remaining non-authoritative fallback usage in broader non-game surfaces if the product direction still calls for stricter visual locking.
