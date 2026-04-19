# Elaria + Thalassar Pipeline Notes

## Runtime readiness completed

- Added a shared Spiritkin media-slot registry used by both the frontend and the backend video whitelist path.
- Elaria and Thalassar now have explicit intro-trailer slots marked as awaiting final media instead of being absent from the runtime model.
- Founder preview surfaces now show that their self-reveal pipeline is wired and waiting for final trailer media.

## Why this matters

- The runtime no longer assumes only Lyra, Raien, and Kairo can ever have intro trailers.
- When final Elaria / Thalassar media arrives, the structure is already in place for:
  - frontend preview resolution
  - backend video serving whitelist
  - bonded selection / preview flow

## Still waiting on Manus

- final intro trailer files
- any additional portrait or ambient media tied to those introductions
