# Trailer Centerpiece And Theme Authority Report

## What Changed In Founder Selection Flow

- Selecting a founder still routes through `pendingBondSpiritkin`, but the reveal handoff now explicitly scrolls to the trailer anchor when a real intro trailer exists.
- The founder grid now recedes when a founder is selected:
  - non-selected founders dim and shrink slightly
  - the selected pending founder remains visually dominant
- The pending reveal stage now receives stronger scale and larger reveal media treatment.

## How Trailer Centerpiece Behavior Now Works

- If a selected founder has a real intro trailer configured, the reveal stage becomes trailer-first.
- The pending reveal stage no longer stacks competing still media into the same stage when the trailer exists.
- Still reveal art remains the centerpiece only for founders without a configured trailer.

## What Theme Backgrounds Now Affect

- In-page themed shells now receive theme-environment overrides for:
  - `--game-room-art`
  - `--game-board-art`
  - `--game-accent-art`
- Theme variants now map to stronger environment imagery instead of tint-only changes:
  - `crown`
  - `veil`
  - `ember`
  - `astral`
  - `abyssal`

## How Grand Stage Inherits Theme

- Grand Stage now receives the active theme variant through `data-theme`.
- Grand Stage background art now respects theme-environment overrides rather than using only the base room asset.
- The fullscreen overlay now layers:
  - theme-specific environment background
  - theme-specific radial atmosphere
  - accent art support layer

## What Fit And Fill Issues Were Corrected

- Pending reveal trailers now use a larger minimum stage height so they feel like the centerpiece instead of a medium tile.
- Trailer media now uses centered cover positioning.
- The selection stage hides redundant still-art elements when a real trailer exists.
- Chess theme controls were widened to better fit the stronger theme authority layout.

## What Still Remains After This Pass

- Theme authority is stronger, but some theme variants still rely on the best available cross-domain art rather than perfectly isolated per-theme room packages.
- I completed code-level verification and syntax checks, but I did not have browser automation in this session, so final visual confirmation still needs a live browser pass.
