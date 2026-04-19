# Chess Showcase Phase 2 Notes

## What animations were added

- Committed chess moves now animate as motion instead of appearing as instant teleports.
- The moving piece uses a ghost-piece overlay that travels from source square to destination square.
- Motion timing is tuned to a short premium feel window:
  - approximately 220ms
  - ease-out
  - slight scale-down from a lifted start state toward final landing
- Captures now trigger a quick destination-square flash/fade effect.
- Landed pieces briefly pulse on arrival so both player and Spiritkin moves feel acknowledged.
- A `playMoveSound()` stub hook now fires when the move animation completes.

## AI move presence upgrades

- Chess now adds a small pre-landing hold before a committed Spiritkin reply move is rendered.
- The existing thinking banner remains active during that hold.
- When the committed AI move lands, it uses the same move animation path as the player move and preserves destination highlighting.

## Board / interaction feel upgrades

- Board edges now have stronger inner shadow and lighting depth.
- Expanded chess presentation uses a lighter perspective treatment instead of the heavier prior pseudo-3D tilt.
- Selected pieces now feel more alive:
  - glow ring
  - slight lift
  - stronger selection emphasis
- Valid move markers were brightened slightly without pushing into noisy over-glow.

## What still needs real assets

- Isolated transparent chess pieces per side and type
- Dedicated capture burst / move trail assets
- Dedicated selected-square and destination-square overlays
- A larger final board art cut tailored for in-panel and fullscreen chess
- Dedicated chess win/loss banners beyond the current generic large result banners

## What Phase 3 should upgrade

- True premium 3D chess pieces instead of the current inline SVG piece system
- Piece-specific lighting / material treatment
- More advanced board camera feel for expanded mode
- Optional subtle move sound set once the audio system is attached to the new stub
