## Entry / Media

| Surface | Primary Visual | Shell Visual | Support Visual | Generic Remaining | Notes |
| --- | --- | --- | --- | --- | --- |
| SpiritGate | gate video | `ACTIVE/ui/welcome_close.png` | world-art base theme fallback | no | gate now gets premium shell art without replacing the stable video path |
| welcome open / arrival | trailer video | `ACTIVE/ui/welcome_open.png` | world-art base theme fallback | no | stronger arrival framing |
| SpiritCore welcome hero | `ACTIVE/ui/spiritcore-media-hero.png` | founders composite fallback | guidance strip / copy | no | clear premium welcome anchor |
| founder ensemble | `ACTIVE/ui/spiritcore-spiritkins-portraits.png` | ensemble world-art fallback | founder copy | no | stronger founder panel while preserving stable fallback |
| Spiritkin preview / focus / bonded panels | stable portrait runtime from `/portraits/...` | Manus open/close panels for Lyra, Raien, Kairo | existing sigils / realm gradients | Elaria / Thalassar still use older world-art/portrait path | direct identity stays readable; new media is shell/support only |

## Games

| Game | Primary Visual | Shell Visual | Support Visual | Generic Remaining | Production-Level Now |
| --- | --- | --- | --- | --- | --- |
| Chess | Lyra board base + SVG pieces | chess room scene | family sheets + overlay set | no major generic shell remains | yes, stable premium board shell with readable direct runtime |
| Checkers | Dragonforge board + direct checker tokens | dragonforge room | family art + move marker FX | no major generic shell remains | yes, stable premium board shell with readable direct runtime |
| Connect Four | waterfall board + direct disc tokens | waterfall room | disc family + FX family | no major generic shell remains | yes |
| Battleship | forge tactical concept shell + readable live grid | forge room | ship sets + marker family | no | yes, now visually themed instead of placeholder |
| Tic Tac Toe | forest concept board + direct tokens | forest room | token family + glow FX | no | yes |
| Go preview | aquatic board + direct preview stones | aquatic room | stone families + ring FX | preview-only truthfulness remains by design | yes for preview state |
| Spirit Cards | `Book Covers All.png` shell | `Spiritkins in spiritverse.png` room shell | placeholder card backs/frames + modal frame | card-face assets still generic | improved and intentional, but still awaits final card art |
| Echo Trials | `spiritcore-architecture-layers.png` shell | `Spiritverse_all_games_together_theme.png` room shell | modal frame | some trial-specific runtime art still generic | improved and intentional |
| Grand Stage | `spiritcore-architecture-layers.png` platform shell | `Spiritverse_all_games_together_theme.png` room shell | modal frame + spotlight FX | no generic primary shell remains | improved and intentional |

## Remaining Generic Surfaces

1. `Spirit Cards` card back / frame SVGs remain generic because there is no better isolated card-system replacement yet.
2. some non-core support assets for Echo Trials remain structurally generic because there is no richer trial-specific art wave yet.
3. Elaria and Thalassar do not yet have the same dedicated Manus-style open/close panel set as Lyra, Raien, and Kairo.

## What Is Now Production-Level

1. Entry surfaces now use purpose-built shell art instead of relying on a generic-looking primary layer.
2. Founder and Spiritkin surfaces now mix stable direct-runtime portraits with stronger shell/support art instead of replacing identity art blindly.
3. Every live game now has a committed visible themed board shell and room shell that resolves through runtime.
4. Battleship, Spirit Cards, Echo Trials, and Grand Stage no longer rely on placeholder-first primary shells where better concept art already existed.

## What Still Needs Future Final Assets

1. a fully isolated premium Spirit Cards runtime set
2. trial-specific Echo Trials art
3. verified premium direct chess/checkers piece replacements if those are reintroduced later
4. richer Elaria and Thalassar dedicated shell media
