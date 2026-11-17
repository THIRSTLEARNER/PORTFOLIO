# Animation plans

Plans written against commit `cd07600`.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Necklace: double rope, longer pull, drag rotation, richer medal](001-necklace-double-rope-pull-rotation.md) | MEDIUM | DONE (reviewed; rope attachment amended to go behind the medal) |
| 002 | [Cover crumble: the whole face, not just the glyphs](002-cover-crumble-whole-face.md) | HIGH | DONE (implemented with the full 002 audit batch: physics, easing, reduced-motion) |

## Recommended order

1. **001** — self-contained; no dependencies. DONE.
2. **002** — whole-face crumble + the whole 002 audit batch. DONE.

## Dependencies

- None. 001 touches `src/components/Necklace.jsx` + necklace blocks; 002 touches `src/components/GalaxyRunner.jsx` + one CSS line. No files overlap.

## 002 audit batch — all findings landed (this session)

- HIGH — the face now disintegrates as ONE object: the cover is rendered to an offscreen canvas at tap time and its actual pixels are harvested as chunky grid-snapped tiles (moonlit-slate lift for background dust so it reads against the void). No per-region budgets to starve; ~720 tiles, glow-weighted naturally by pixel luminance.
- MEDIUM — constellation joints and eye pop from `scale(0.55)` / `scale(0.6)` (were `scale(0)`).
- MEDIUM — canvas reveal is opacity-only under `prefers-reduced-motion` (transform dropped).
- LOW — exit/dissolve easings and durations moved to repo tokens (`--ease`, `--ease-out`, `--dur-instant…--dur-slow`).
- Missed opportunities — additive `runner-flash` screen-blend flash at the disintegration peak (JS-spawned, skipped under reduced motion); white glow-spark particle per constellation joint as it winks out.

Verified: production build green; crumble visuals checked in headless Chrome (debris cloud + bone arc confirmed); reduced-motion static frame and flash-peak frame both confirmed clean.
