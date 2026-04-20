## Elaria and Thalassar fixes

- Added one authoritative founder-media mapping source in [spiritkins-app/app.js](C:/spiritcore-backend/spiritkins-app/app.js) for:
  - founder card image
  - focus/profile image
  - bonded panel image
  - fallback card image
  - portrait image
  - canon supplement image
- Elaria now resolves from:
  - `/app/active-assets/concepts/Elaria.png`
  - fallback supplement `/app/active-assets/concepts/Elaria%20Left%20Thalassar%20right.png`
- Thalassar now resolves from:
  - `/app/active-assets/concepts/thalassar.png`
  - fallback supplement `/app/active-assets/concepts/Elaria%20Left%20Thalassar%20right.png`
- Rewired `buildSpiritkinMediaPanel`, `getSpiritkinPortraitPath`, and the profile canon panel path so these founders no longer depend on scattered mixed-source lookups.

## Theme-to-room enforcement changes

- Strengthened `.sv-theme-shell` so room art is no longer buried under an overly dark generic surface wash.
- Increased the visibility of room/background identity by:
  - reducing the top dark overlay
  - widening the accent glow spread
  - strengthening the shell highlight layer
  - ensuring shell children sit above the room art cleanly
- Result: game shells read more like distinct chambers and less like one repeated generic container.

## Trailer placement changes

- Spiritkin intro trailers are now authoritative only in the pending founder reveal surface.
- Bonded home no longer reuses that trailer surface.
- Pending reveal trailers were made larger and more prominent so they behave like a reveal moment instead of a small tile.
- When a pending founder has no trailer media yet, the intro slot note remains in the same reveal location without duplicating trailer surfaces elsewhere.

## Layout and fit fixes

- Selection hero and selection focus panels now align from the top instead of vertically centering mismatched media blocks.
- Spiritkin media panels now have explicit bonded sizing and cleaner image-fit behavior.
- Composite Spiritkin media now uses consistent 16:10 framing on major Spiritkin surfaces.
- Presence tabs now have tighter padding and stronger non-clipping flex behavior.
- Pending founder reveal spacing was cleaned up so large trailer/media surfaces do not crowd each other as aggressively.

## Action-to-surface flow fixes

- `reopen-return-summary` now re-centers the user on the return surface instead of leaving it off-screen.
- `open-bond-manager` now pulls the user back to the founder selection/bond surface.
- `bonded-card` now pulls the user to the bonded-home surface directly.
- `toggle-issue-reporter` now reveals the reporter panel when it opens.
- `open-realm-travel` now centers the realm-travel modal.
- `begin-daily-quest` now brings the user directly to the composer/input surface after moving back to profile.
- `beginConversation()` now explicitly reveals the conversation stage after bootstrapping the conversation.

## What still remains

- Elaria and Thalassar still need dedicated intro trailers if you want parity with Lyra, Raien, and Kairo. This pass only made the non-trailer image path authoritative and stable.
- Some high-density screens still carry more informational panels than a fully polished production pass would keep.
- Game theme identity is materially stronger now, but final production-level chamber differentiation still depends on richer room/board asset coverage.
