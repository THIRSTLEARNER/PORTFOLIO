# 002 — Cover crumble: the whole face, not just the glyphs

- **Status**: DONE
- **Commit**: cd07600
- **Severity**: HIGH
- **Category**: 8 (Missed opportunities) + 5 (Performance)
- **Estimated scope**: 2 files (`src/components/GalaxyRunner.jsx` — the `crumbleDino` function only; `src/styles/global.css` — one deleted line). No markup, no dependencies.

## Problem

The cover's exit is the game's one rare, high-emotion moment — exactly where the
delight budget belongs. It under-delivers: only the wordmark, constellation,
strip rule and frame emit debris. The nebula glows, the starfield and the
comet fade without a single falling pixel, so the eye reads "the text
disintegrates, then the cover vanishes" instead of one total disintegration.

Second, the debris budget is allocated randomly and trimmed globally, so
smaller regions can be starved entirely while text dominates:

```js
// src/components/GalaxyRunner.jsx:169–171 — current
if (!sources.length) return
// small debris budget — keep the frame drop smooth
while (sources.length > 430) sources.splice((Math.random() * sources.length) | 0, 1)
```

`harvestText` always keeps up to 150 lit points dead-or-alive for the
wordmark lines (GalaxyRunner.jsx:100–101), while `strip` (~57 points), `frame`
(~90 points) and `HI`/`CTA` compete for whatever the random trim leaves. This
is also why the face never crumbles evenly.

Third, every particle node is promoted to its own compositing layer:

```css
/* src/styles/global.css:2773–2782 — current */
.runner-pixel-particle {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  pointer-events: none;
  border-radius: 1px;
  image-rendering: pixelated;
  will-change: transform, opacity;
}
```

With a whole-face ambient layer the node count rises to ~500; `will-change`
on 500 nodes is a memory/compositing tax, not an optimization.

## Target

Every visible layer of the cover contributes debris to the **same** physics
loop and the **same** 900ms envelope (cover unmounts at `GalaxyRunner.jsx:236`,
unchanged). Budget is allocated per region; nothing is randomly deleted.

Region quotas (total target ≈ 520 particles):

| Region | Quota | Notes |
|---|---|---|
| `.is-filled` (GALAXY) | 95 lit points | down from 150 |
| `.is-open` (RUNNER) | 85 lit points | down from 150 |
| `.runner-cover-hi` | 32 | down from 150 |
| `.runner-cover-cta` | 42 | down from 150 |
| Constellation bones (points along segments) | 48 | thin stochastically if more |
| Joint stars (16 × 3) | 48 | unchanged |
| Ember eye (7) | 7 | unchanged |
| Horizon strip rule | 52 | thin stochastically if more |
| Cabinet frame | 40 | thin stochastically if more |
| **Ambient whole-face layer (new)** | **88** | deterministic, glow-weighted |

Ambient layer — deterministic density that mirrors the cover's own background
(`.runner-cover` in `global.css`): dense in the ember top-right glow, denser
near the ion horizon band, sparse everywhere else, sweeping left→right:

```js
// to add inside crumbleDino(), after the frame block (after GalaxyRunner.jsx:167)
// ---- ambient: the whole face sheds — weighted by the same glows the cover paints ----
{
  const w = sRect.width
  const h = sRect.height
  const step = 7
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      // ember glow, upper right — mirrors radial-gradient(120% 100% at 82% -12%, …)
      const ex = (x - w * 0.82) / (w * 0.34)
      const ey = (y - -h * 0.12) / (h * 0.42)
      const ember = Math.exp(-(ex * ex + ey * ey))
      // ion horizon glow — mirrors the bottom falloff band of the background
      const horizon = Math.max(0, 1 - Math.abs(y - h * 0.98) / (h * 0.26))
      const density = 0.045 + ember * 0.5 + horizon * 0.42
      if (Math.random() < density) {
        push(x, y, Math.random() < 0.62 ? '#e9fdff' : '#5eead4', 150 + (x / w) * 420 + Math.random() * 120)
      }
    }
  }
}
// ambient quota trim — deterministic shuffle, not a global trim
// (apply take(list, 88) to the ambient points before pushing, or thin inline)
```

`push` is the existing helper (`GalaxyRunner.jsx:56`). `sRect` is already in
scope (`GalaxyRunner.jsx:53`). Implementation detail for the trim — add a
small helper inside `crumbleDino` and route every region through it:

```js
const take = (list, n) => {
  if (list.length <= n) return list
  const out = []
  const used = new Set()
  while (out.length < n) {
    const i = (Math.random() * list.length) | 0
    if (!used.has(i)) { used.add(i); out.push(list[i]) }
  }
  return out
}
```

`harvestText` gains a fourth parameter `keep` (points to retain); call sites
change as in the quota table above, and internally use
`const keepPts = take(lit, keep)` instead of `Math.min(lit.length, 150)`.
After the frame block, before building `particles`, do:

```js
// region quotas already applied — nothing to delete; keep as-is
```

i.e. **delete** the `while (sources.length > 430) …` block entirely.
Bones: wrap the bone-point accumulation so it stops at 48 points — e.g.
accumulate into a local array and `sources.push(...take(bonePts, 48))`.
Strip: change the `px += 5` loop to collect into an array and
`sources.push(...take(stripPts, 52))`. Frame: collect then `take(framePts, 40)`.

CSS — one deletion (`global.css:2781`):

```css
/* target — .runner-pixel-particle */
.runner-pixel-particle {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  pointer-events: none;
  border-radius: 1px;
  image-rendering: pixelated;
}
```

Delete only the `will-change: transform, opacity;` line. Everything else —
physics constants (gravity `1150`, `vy: -35 - Math.random() * 120`, `vx:
(Math.random() - 0.5) * 95`, spin `(Math.random() - 0.5) * 540`, life
`920ms`, fade window `500→920ms`), the DOM dissolve transitions, the 900ms
unmount, reduced-motion short-circuit — stays exactly as is.

## Repo conventions to follow

- Easing tokens: exit-side motion already uses the repo curve; ambient debris
  uses no CSS easing (physical integration) — nothing to add.
- Exemplars: the constellation joint burst at `GalaxyRunner.jsx:127–130`
  (per-point stochastic delays, per-joint stagger) and the strip center-out
  sweep at `GalaxyRunner.jsx:142–146` — the ambient layer mirrors this
  center-out/left→right sweep idea, not a new pattern.
- Particle creation/physics loop at `GalaxyRunner.jsx:173–221` is the single
  source of truth — ambient points are appended to the same `sources` array
  and join the same loop unchanged.

## Steps

1. `src/components/GalaxyRunner.jsx` — add the `take(list, n)` helper inside
   `crumbleDino` (directly after `const push = …`, line 56).
2. Change `harvestText` to accept a 4th parameter `keep` and use it:
   replace `const keep = Math.min(lit.length, 150)` with
   `const litCapped = take(lit, keep)` and iterate `litCapped` instead of
   drawing `keep` random samples (the sweep mapping stays).
3. Update the four `harvestText` call sites: GALAXY `keep = 95`, RUNNER
   `keep = 85`, HI `keep = 32`, CTA `keep = 42`.
4. Bones block: accumulate points into `const bonePts = []`, then
   `sources.push(...take(bonePts, 48))`.
5. Strip block: accumulate into `const stripPts = []`,
   `sources.push(...take(stripPts, 52))`.
6. Frame block: accumulate into `const framePts = []`,
   `sources.push(...take(framePts, 40))`.
7. Add the Ambient layer block verbatim (Target section above), wrapped in
   `{ … }` and placed after the frame block, with its own
   `const ambientPts = []` → `sources.push(...take(ambientPts, 88))`.
8. Delete the global trim:
   ```js
   while (sources.length > 430) sources.splice((Math.random() * sources.length) | 0, 1)
   ```
9. `src/styles/global.css` — delete the `will-change: transform, opacity;`
   line inside `.runner-pixel-particle`.
10. Rebuild and verify (below). Do not touch any other selector, file, or
    the game loop.

## Boundaries

- Do NOT touch markup, JSX structure, or any other style block.
- Do NOT add dependencies, change the physics constants, or alter the 900ms
  unmount/unmount-focus sequence.
- Do NOT change anything about the entrance choreography
  (mask lines, bone draw-in, dot pop, eye flare).
- Reduced motion remains exactly as is (particles never spawn).
- If the code you find differs from the excerpts here (drift since cd07600),
  STOP and report — do not improvise.

## Verification

- **Mechanical**: `npm run build` → exits 0, no warnings from Vite about the
  CSS (lightningcss may note nothing; any build error = NOT done).
- **Feel check** — serve the built app, open `#playground`, tap the cover:
  - The debris cloud should read as the *entire* face shedding at once:
    wordmark, constellation, horizon line, frame ticks, nebula glow, and a
    faint ambient shimmer across the dark sky regions — not just the letters.
  - Left→right sweep is still perceptible (GALAXY first, ambient shimmer
    chasing it, strip falling center-out, frame peeling by the sides).
  - Total burst visible ~700ms, cleared by the 900ms unmount + focus.
  - DevTools → Animations panel → 10% playback: bone debris arcs are smooth
    (no per-frame allocation jank); joints fizzle rather than blink out.
  - Rendering panel → emulate `prefers-reduced-motion: reduce`: no particles
    spawn; the cover dissolves instantly; the runner still starts behind it.
  - Check both widths: 1440px (max particle count ~520) and 390px (all
    regions compressed; ambient density scales with `sRect` automatically).
  - Watch for frame drops: on a mid-tier phone (or 4× CPU throttle in
    DevTools) the burst should not force long tasks below 30fps. If it
    stutters, halve the ambient step (7 → 9px) — do NOT re-add `will-change`.
- **Done when**: tapping the cover in Chrome at 1440×900 shows debris
  originating from every visible layer (wordmark, dino, strip, frame, nebula,
  starfield region) and a human eye cannot find a "clean" region that simply
  faded. Build exits 0.
