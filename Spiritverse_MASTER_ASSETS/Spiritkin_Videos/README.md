Spiritkin speaking video assets live here.

Expected structure:

- `Lyra/idle/idle_01.mp4`
- `Lyra/speaking/speaking_01.mp4`
- `Lyra/emotional/calm_01.mp4`
- `Lyra/emotional/excited_01.mp4`
- `Lyra/emotional/serious_01.mp4`
- `Lyra/special/...`

Repeat the same folder layout for:

- `Raien`
- `Kairo`
- `Elaria`
- `Thalassar`

The frontend uses `spiritkins-app/data/spiritkinVideoManifest.js` as the authoritative manifest and falls back to static portraits if any video is missing or fails to load.
