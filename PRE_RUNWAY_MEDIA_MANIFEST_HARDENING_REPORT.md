# Pre-Runway Media Manifest Hardening Report

## Scope

- Added a Spiritkin media manifest for available portrait, heroImage, trailerVideo, idleVideo, speakingVideo, calmVideo, and fallbackImage slots.
- Kept Runway ML out of scope.
- Did not change backend intelligence or database schema.

## Media Availability

| Spiritkin | Portrait | Hero image | Trailer video | Idle video | Speaking video | Calm video | Fallback image |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lyra | ready | ready | ready | unavailable | unavailable | unavailable | ready |
| Raien | ready | ready | ready | unavailable | unavailable | unavailable | ready |
| Kairo | ready | ready | ready | unavailable | unavailable | unavailable | ready |
| Solis | ready | ready | unavailable | unavailable | unavailable | unavailable | ready |
| Neris | ready | ready | unavailable | unavailable | unavailable | unavailable | ready |

## Missing Media Solved

- The Spiritkin video manifest no longer emits idle, speaking, or emotional MP4 URLs for empty placeholder folders.
- Solis and Neris are represented directly in the media manifest while legacy Elaria and Thalassar lookups remain compatible.
- Selection and bond media now prefer manifest-ready trailer paths and fall back to still imagery when a trailer is absent or fails.

## Fallback Behavior

- Unavailable video slots resolve to no URL, so the browser does not request known-missing media.
- If a video element errors during the session, that media owner is marked failed and rerenders to the still-image surface.
- Trailer failure logging was silenced to avoid repeated console noise; existing session failure tracking prevents repeated attempts.

## Future Compatibility

- The manifest is slot-based, so future custom or premium Spiritkins can attach ready media per slot without changing UI behavior.
- Current custom Spiritkin creator media slots remain untouched.
