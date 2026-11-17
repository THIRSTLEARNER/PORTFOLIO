# 001 — Necklace: double rope, longer pull, drag rotation, richer medal

- **Status**: DONE — implemented at commit `cd07600` (+ working-tree changes), reviewed.
  Post-review amendment requested by the owner: the bail was removed; the rope now
  continues 28px behind the medal (`.necklace-chain` `z-index: 1`) and terminates
  in a small `.necklace-collar` grommet at the rim, so it reads as threaded
  through the disc instead of sitting on top. See the "Amendment" section at the end.
- **Commit**: cd07600
- **Severity**: MEDIUM (feel + design change requested)
- **Category**: Physicality & origin, Easing & duration, Performance, Cohesion
- **Estimated scope**: 2 files (`src/components/Necklace.jsx`, `src/styles/global.css`), ~180 lines changed

## Problem

The hero medallion necklace is the page's main play moment, but it currently:

1. **Pulls only 96px** and returns fast, so the "rubber band" reads as a twitch rather than a pull.
   `src/components/Necklace.jsx:5-13` (current):
   ```js
   const SPRING = 6.3 // longer chain = slower, more stately pendulum
   const DAMPING = 2.15
   const SPIN_SPRING = 26
   const SPIN_DAMPING = 3.8
   const STRETCH_MAX = 96 // px the chain can stretch like a rubber band
   const STRETCH_SPRING = 320 // stiff spring — release makes it snap
   const STRETCH_DAMPING = 14
   const BOB_SPRING = 92
   const BOB_DAMPING = 7.5
   ```

2. **Has a single flat 7px chain**, not a double rope.
   `src/styles/global.css:3368-3390` (current):
   ```css
   .necklace-chain {
     position: absolute;
     left: 0;
     top: 0;
     width: 7px;
     height: var(--pivot-offset);
     transform: translateX(-50%);
     border-radius: 4px;
     background:
       linear-gradient(90deg, #0b0716 0%, #1d1436 12%, #32245a 26%, #4c357e 40%, #7a5ed6 50%, #4c357e 60%, #32245a 74%, #1d1436 88%, #0b0716 100%);
     ...
   }
   .necklace-chain::after {
     content: "";
     position: absolute;
     inset: 0;
     border-radius: inherit;
     background: repeating-linear-gradient(180deg, transparent 0 6px, rgba(6, 10, 14, 0.8) 6px 8.6px);
   }
   ```

3. **Cannot be deliberately rotated.** Spin only comes from flick velocity (`s.lastDragVelocityH * 0.026`, `Necklace.jsx:212`) and the spring always yanks it back to exactly `0` (`Necklace.jsx:127-133`), so it can never rest at an angle and dragging horizontally does not turn it.

4. **Driver per-frame layout.** Every frame does `chain.style.height = …` and `pendant.style.top = …` (`Necklace.jsx:85-93`), which triggers layout + paint for the chain and pendant at 60fps during drag and the ~2s return. Animating `height`/`top` is off-GPU work (AUDIT category 5: animate `transform`/`opacity` only). The same visual can be done with `scaleY` on the rope and `translate3d` on the pendant, both composite-only.

## Target

### Feel
- Chain can be pulled **190px** (or 62% of measured chain length on short viewports), with a slower, springier snap-back; pendulum swing visibly longer (≈6–7s to settle from a 60° throw).
- Dragging the medal **left/right turns it like a coin at 1:1** for the whole drag, keeps momentum on release, allows several full turns, then settles on the **nearest face** (0° or 180°) instead of unwinding backwards.
- Everything still kills movement under `prefers-reduced-motion`.

### Physics values (copy exactly)
```js
const TAU = Math.PI * 2
const MAX_ANGLE = 1.05        // ~60° while dragging
const SWING_CLAMP = 1.32      // ~76° free-swing cap
const SPRING = 3.6            // pendulum: longer period, longer settle
const DAMPING = 1.15          // underdamped (ζ ≈ 0.30) → ~6 swings
const SPIN_SPRING = 12        // soft: medal glides to nearest face
const SPIN_DAMPING = 2.0
const SPIN_DRAG = 0.017       // rad of rotateY per px of horizontal drag
const SPIN_MAX_VELOCITY = 22  // rad/s cap on release
const STRETCH_MAX = 190       // px of rubber-band travel
const STRETCH_SPRING = 130    // softer + slower return than 320
const STRETCH_DAMPING = 7
const BOB_SPRING = 48         // longer hop, longer settle
const BOB_DAMPING = 4.6
const PULL_RATIO_MAX = 0.62   // never stretch past 62% of chain length
const MIN_CHAIN_RATIO = 0.78  // chain can never invert on itself
```

### Visual target
- **Double rope**: two 6px braided strands, splayed ~1.35° from a shared pin and converging at the bail (V shape), each with a diagonal braid weave and metallic cyan/violet sheen; a soft light core between them.
- **Medal**: a metallic conic-gradient rim ring around the avatar, beveled; the reverse side gets a milled edge and stays on the existing engraved design.
- **Bail**: 28px ring so it reads as receiving two strands.
- **Tag**: beveled stamped plate, not a flat pill.
- A gentle sheen travels down the rope (~7s loop) and a rim glow breathes (~5s) — both disabled under reduced motion.
- Nothing animates with `height`/`top` per frame.

## Repo conventions to follow

- CSS custom properties are used for motion in this file already: `src/styles/global.css:634-635`
  ```css
  transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform var(--dur-settle) var(--ease), ...
  ```
  Reuse `--ease` / `--dur-*` tokens where a CSS transition is added; do not introduce new easing names.
- All necklace styles live in one block, `/* ===== NECKLACE (galaxy charm chain) ===== */` at `global.css:3332`, with the 3D flip block right after at `global.css:3459`. Keep new rules inside those blocks.
- JS physics stays in the single `useLayoutEffect` with the `state.current` ref bag; no new dependencies, no React state, no re-renders.
- Reference for how the rest of the site does decorative glints: `.necklace-pin` `@keyframes necklace-pin-glint` (`global.css:3351-3356`) — cheap `filter`/opacity only.
- Reference for reduced-motion handling: `global.css:3451-3458`.

## Steps

### 1. `src/components/Necklace.jsx` — replace the constants block (lines 3-13)

```js
const TAU = Math.PI * 2

const MAX_ANGLE = 1.05 // radians (~60°) while dragging
const SWING_CLAMP = 1.32 // radians (~76°) hard cap while swinging freely
const SPRING = 3.6 // long chain = slow, stately pendulum (~6-7s to settle)
const DAMPING = 1.15 // underdamped → several visible swings
const SPIN_SPRING = 12 // soft coin spring — glides to the nearest face
const SPIN_DAMPING = 2.0
const SPIN_DRAG = 0.017 // rad of rotateY per px of horizontal drag
const SPIN_MAX_VELOCITY = 22 // rad/s
const STRETCH_MAX = 190 // px the chain can stretch like a rubber band
const STRETCH_SPRING = 130 // softer spring — long, elastic return
const STRETCH_DAMPING = 7
const BOB_SPRING = 48 // vertical hop spring for the release jump
const BOB_DAMPING = 4.6
const PULL_RATIO_MAX = 0.62 // cap stretch relative to measured chain length
const MIN_CHAIN_RATIO = 0.78 // chain can never invert on itself
```

### 2. `src/components/Necklace.jsx` — extend `state.current` (lines 34-52)

Add these keys to the object literal (keep every existing key):

```js
    spinTarget: 0, // nearest face (radians, multiple of TAU) the medal settles on
    pointerStartX: 0,
    pointerStartY: 0,
    moved: 0, // total px the pointer travelled this drag (click suppression)
```

### 3. `src/components/Necklace.jsx` — replace `applyStretch` with a composite-only `applyPull`, defined **before** `measure`

Delete the old `applyStretch` (`lines 85-93`) and insert this above `const measure = …`:

```js
    const applyPull = () => {
      const s = state.current
      // bobY can pull the chain taut (jump upward) — clamp so links never invert
      const len = Math.max(s.restLen * MIN_CHAIN_RATIO, s.restLen + s.stretch + s.bobY)
      // Composite-only: stretch the rope with scaleY, move the medal with translate3d.
      // Never animate height/top per frame (layout + paint every frame).
      chain.style.transform = `translateX(-50%) scaleY(${(len / s.restLen).toFixed(5)})`
      pendant.style.transform = `translate3d(-50%, ${(len - s.restLen).toFixed(2)}px, 0)`
    }
```

### 4. `src/components/Necklace.jsx` — update `measure` (lines 63-70)

```js
    const measure = () => {
      const hero = document.querySelector('.hero')
      const avatar = swing.closest('.hero-avatar')
      if (!hero || !avatar) return
      const offset = Math.max(80, avatar.getBoundingClientRect().top - hero.getBoundingClientRect().top)
      avatar.style.setProperty('--pivot-offset', `${offset}px`)
      state.current.restLen = offset // keep the physics in sync with the visual anchor
      chain.style.height = `${offset}px` // layout write happens here only, not per frame
      applyPull()
    }
```

### 5. `src/components/Necklace.jsx` — update the spin block in `step` (lines 126-133)

```js
      // Medallion coin-spin: elastic glide to the nearest face (0° or 180°)
      const spinAccel = -SPIN_SPRING * (s.spin - s.spinTarget) - SPIN_DAMPING * s.spinVelocity
      s.spinVelocity += spinAccel * dt
      s.spin += s.spinVelocity * dt
      if (Math.abs(s.spin - s.spinTarget) < 0.002 && Math.abs(s.spinVelocity) < 0.01) {
        s.spin = s.spinTarget
        s.spinVelocity = 0
        // keep values bounded — the medal may have done several full turns
        s.spin %= TAU
        s.spinTarget %= TAU
      }
```

### 6. `src/components/Necklace.jsx` — replace `applyStretch()` calls and idle nudge

- In `step` (was `line 124`) call `applyPull()`.
- In `onPointerMove` (was `line 192`) call `applyPull()`.
- Idle nudge (lines 149-153) becomes a slightly longer, softer life sign:

```js
      s.idleClock += dt
      if (s.idleClock > 8.5) {
        s.velocity += (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5)
        s.idleClock = 0
      }
```

### 7. `src/components/Necklace.jsx` — `onPointerDown` (lines 161-181)

Add at the end of the handler, after `lastDragT` is set and before `pendant.classList.add('is-held')`:

```js
      state.current.pointerStartX = e.clientX
      state.current.pointerStartY = e.clientY
      state.current.moved = 0
      state.current.spinTarget = state.current.spin
```

### 8. `src/components/Necklace.jsx` — `onPointerMove` (lines 183-206)

Inside the handler, after `const dx = e.clientX - s.cx` add the drag-rotate line, and use the capped stretch:

```js
      const dxStep = e.clientX - s.lastDragX // px moved since last move event
      s.spin -= dxStep * SPIN_DRAG // drag left/right turns the coin 1:1
      s.spinTarget = s.spin // hold the pose while the pointer owns it
      s.moved = Math.max(s.moved, Math.hypot(e.clientX - s.pointerStartX, e.clientY - s.pointerStartY))
```

Replace the stretch line (`line 191`) with:

```js
      const stretchCap = Math.min(STRETCH_MAX, s.restLen * PULL_RATIO_MAX)
      s.stretch = Math.max(0, Math.min(stretchCap, dist - s.restLen)) // rubber band!
```

### 9. `src/components/Necklace.jsx` — `endDrag` (lines 208-218)

```js
    const endDrag = (e) => {
      const s = state.current
      s.dragging = false
      // release with the flick — horizontal px/s becomes coin spin
      s.spinVelocity = Math.max(-SPIN_MAX_VELOCITY, Math.min(SPIN_MAX_VELOCITY, s.lastDragVelocityH * 0.03))
      // settle on whichever face the throw is heading toward (never unwind backwards)
      s.spinTarget = Math.round((s.spin + s.spinVelocity * 0.12) / TAU) * TAU
      // the JUMP fires on ANY real pull — chain stretched at all, or a flick with momentum
      if (s.stretch > 4 || Math.abs(s.velocity) > 0.7) {
        s.bobVel = -(520 + Math.min(640, s.stretch * 5 + Math.abs(s.velocity) * 140))
      }
      pendant.classList.remove('is-held')
      // A drag is not a tap: swallow the click that would otherwise advance the slideshow
      if (e && typeof e.clientX === 'number' && s.moved > 6) {
        const swallow = (ev) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        window.addEventListener('click', swallow, { capture: true, once: true })
      }
    }
```

`pointerup` / `pointercancel` already pass the event; no listener changes needed.

### 10. `src/components/Necklace.jsx` — render double rope + rim (return block, lines 258-263 and 261-290)

Replace the chain div and add the rim inside the flip:

```jsx
      <div ref={swingRef} className="necklace-swing">
        <div ref={chainRef} className="necklace-chain" aria-hidden="true">
          <span className="necklace-strand necklace-strand--a" />
          <span className="necklace-strand necklace-strand--b" />
        </div>
        <div ref={pendantRef} className="necklace-pendant">
          <div ref={flipRef} className="necklace-flip">
            <div className="necklace-bail" aria-hidden="true" />
            <div className="necklace-tag" aria-hidden="true">RM</div>
            <span className="necklace-rim" aria-hidden="true" />
            {children}
            <div className="necklace-medal-back" aria-hidden="true">
              {/* existing back SVG unchanged */}
            </div>
          </div>
        </div>
      </div>
```

### 11. `src/styles/global.css` — replace `.necklace-chain`, `::after`, `::before`, add strands (lines 3368-3408)

```css
.necklace-chain {
  position: absolute;
  left: 50%;
  top: 0;
  width: 18px;
  height: var(--pivot-offset);
  transform: translateX(-50%);
  transform-origin: 50% 0;
  will-change: transform;
}
.necklace-strand {
  position: absolute;
  top: 0;
  height: 100%;
  width: 6px;
  border-radius: 3px;
  transform-origin: 50% 0;
  /* diagonal weave over a metallic core = twisted rope */
  background:
    repeating-linear-gradient(158deg,
      rgba(6, 10, 14, 0.92) 0 2.2px,
      rgba(190, 249, 255, 0.42) 2.2px 3.4px,
      rgba(74, 58, 130, 0.92) 3.4px 6.2px,
      rgba(10, 7, 24, 0.95) 6.2px 8.4px),
    linear-gradient(90deg, #0b0716 0%, #241a45 22%, #6f5bd6 50%, #241a45 78%, #0b0716 100%);
  box-shadow:
    inset 0 0 2px rgba(6, 10, 14, 0.9),
    0 0 9px rgba(124, 94, 214, 0.28);
}
.necklace-strand--a {
  left: 50%;
  margin-left: -7px;
  transform: rotate(1.35deg);
}
.necklace-strand--b {
  left: 50%;
  margin-left: 1px;
  transform: rotate(-1.35deg);
}
.necklace-chain::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1.4px;
  margin-left: -0.7px;
  border-radius: 2px;
  background: linear-gradient(180deg,
    rgba(190, 249, 255, 0) 0%,
    rgba(190, 249, 255, 0.9) 14%,
    rgba(94, 234, 212, 0.3) 52%,
    rgba(190, 249, 255, 0.85) 82%,
    rgba(190, 249, 255, 0) 100%);
  mix-blend-mode: screen;
  opacity: 0.9;
  animation: necklace-rope-sheen 7s linear infinite;
}
@keyframes necklace-rope-sheen {
  0%, 100% { opacity: 0.35; transform: translateY(-6%); }
  50% { opacity: 0.95; transform: translateY(6%); }
}
```

Delete the old `.necklace-chain::after` rule entirely (the weave moved into the strands).

### 12. `src/styles/global.css` — pendant transform + held overrides (lines 3409-3422)

```css
.necklace-pendant {
  position: absolute;
  left: 0;
  top: var(--pivot-offset);
  transform: translateX(-50%);
  will-change: transform;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  filter: drop-shadow(0 20px 34px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 28px rgba(124, 94, 214, 0.35)) drop-shadow(0 0 10px rgba(94, 234, 212, 0.25));
}
.necklace-pendant.is-held {
  cursor: grabbing;
}
/* while held, the coin spin owns the rotation — kill the hover tilt so they don't fight */
.necklace-pendant.is-held .profile-switcher {
  transform: perspective(900px) rotateX(0deg) rotateY(0deg);
  transition: none;
}
```

### 13. `src/styles/global.css` — bail 28px (lines 3423-3441)

Change only these declarations, leave the gradient/shadow as-is:

```css
.necklace-bail {
  top: -15px;
  width: 28px;
  height: 28px;
  border-width: 3.4px;
  ...
}
```

### 14. `src/styles/global.css` — add rim, milled edge, tag bevel (append inside the 3D block at line 3459)

```css
.necklace-rim {
  position: absolute;
  inset: -7px;
  z-index: 2;
  border-radius: 50%;
  pointer-events: none;
  background: conic-gradient(from 210deg,
    #0a0718 0deg,
    #6f5bd6 40deg,
    #bef9ff 78deg,
    #2b6f86 124deg,
    #0a0718 168deg,
    #4c357e 224deg,
    #bef9ff 268deg,
    #1a1236 312deg,
    #0a0718 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  box-shadow: 0 0 18px rgba(94, 234, 212, 0.28), inset 0 0 8px rgba(0, 0, 0, 0.6);
  animation: necklace-rim-breathe 5.2s ease-in-out infinite alternate;
}
.necklace-rim::after {
  content: "";
  position: absolute;
  inset: 1.5px;
  border-radius: 50%;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.28),
    inset 0 -2px 4px rgba(0, 0, 0, 0.55);
}
@keyframes necklace-rim-breathe {
  from { opacity: 0.75; }
  to { opacity: 1; }
}
.necklace-medal-back::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0.8;
  background: repeating-conic-gradient(from 0deg,
    rgba(190, 249, 255, 0.14) 0deg 0.5deg,
    transparent 0.5deg 1.7deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 13px), #000 calc(100% - 12px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 13px), #000 calc(100% - 12px));
}
```

For `.necklace-tag` (lines 3470-3494) change only the bevel: `border-radius: 4px;`, and replace its `background` + `box-shadow` with:

```css
  background: linear-gradient(180deg, #4a3a82 0%, #332760 30%, #1c1440 66%, #0a0618 100%);
  box-shadow:
    inset 0 1px 0 rgba(190, 249, 255, 0.35),
    inset 0 -2px 3px rgba(0, 0, 0, 0.7),
    0 2px 6px rgba(0, 0, 0, 0.6),
    0 0 12px rgba(94, 234, 212, 0.35);
```

### 15. `src/styles/global.css` — reduced motion (extend the block at lines 3451-3458)

```css
@media (prefers-reduced-motion: reduce) {
  .necklace-pin,
  .necklace-chain::before,
  .necklace-rim {
    animation: none;
  }
  .necklace-chain::before { opacity: 0.5; }
  .necklace-rim { opacity: 0.9; }
  .necklace-pendant { cursor: default; }
}
```

## Boundaries

- Do NOT touch `Hero.jsx`, `ProfileSwitcher.jsx`, `portfolioData.js`, or any other component. This is a `Necklace.jsx` + `global.css` change only.
- Do NOT add dependencies, libraries, or a new animation framework.
- Do NOT change the back-of-medal SVG markup or text content.
- Do NOT rename existing classes (`.necklace-swing`, `.necklace-pin`, `.necklace-bail`, `.necklace-tag`, `.necklace-flip`, `.necklace-medal-back`, `.medal-back-text`).
- Do NOT animate `height`, `top`, `width`, or `margin` in the rAF loop; transform/opacity only.
- Do NOT remove the `prefers-reduced-motion` early-return in the effect.
- If the code at these line numbers doesn't match the excerpts above (drift since `cd07600`), STOP and report instead of improvising.

## Verification

- **Mechanical**:
  - `npm run build` → completes with no errors.
  - `npm run dev` → open the hero.
  - DevTools Performance, record while dragging the medal down 150px and releasing:
    - no `Layout` entries attributable to `.necklace-chain` / `.necklace-pendant` during the loop (only on resize);
    - frame time stays under ~16ms on a 4× CPU throttle.
- **Feel check**:
  - Pull the medal down: the chain visibly doubles in length before it stops; the two strands stay parallel and converge at the bail; release → it springs back over ~1.5–2s with one small bounce off the rest stop, then a slow hop, and the pendulum keeps swinging ~6–7s.
  - Drag left/right on the medal: it turns with the pointer the whole way, does more than a full 360° if you drag far enough, and on release coasts then settles showing a face — it must never spin backwards through multiple turns to reach 0°.
  - Drag only downward: the medal should not spin accidentally (vertical drag leaves `spinTarget` where it was).
  - Grab a spinning medal: it calms immediately, then follows the pointer.
  - Turn on `prefers-reduced-motion` (Rendering panel): necklace is static, no rope sheen, no rim breathe, no grab cursor, no jump.
  - At 390px viewport: the 190px pull must not push the medal past the hero copy in a way that covers text; if it does, lower `PULL_RATIO_MAX` to `0.5` and re-check (this is the only permitted deviation).
  - Click the medal without dragging: the slideshow still advances. Drag then release: the slideshow does NOT advance.
  - In DevTools Animations panel at 10% playback: rim glow and rope sheen read as a slow breathe, not a pulse.
- **Done when**:
  - `grep -n "style.height" src/components/Necklace.jsx` returns only the single `measure()` assignment.
  - `grep -n "SPIN_DRAG\|PULL_RATIO_MAX\|necklace-strand\|necklace-rim" src/components/Necklace.jsx src/styles/global.css` shows the new names in both files.
  - The four feel checks above pass on desktop and at 390px.

## Amendment (owner request, after review)

The rope must go *behind* the medal, not sit on top of the circle:

- Removed `.necklace-bail` (markup + CSS). Added `.necklace-collar`: an 18×13px
  metallic grommet at the medal's top edge (`top: -6px`, `z-index: 5`) with a dark
  inner hole, so the rope visibly enters the disc at the rim.
- `.necklace-chain` now has `z-index: 1` and `.necklace-pendant` `z-index: 2`, so the
  rope passes behind the avatar.
- `ROPE_EMBED = 28` in `Necklace.jsx`: the rope's height is `restLen + 28` and
  `applyPull` scales by `(len + 28) / (restLen + 28)`, so the bottom 28px stay hidden
  behind the medal at rest and while stretched.
- Strand splay reduced from ±1.35° to ±0.6° so the two ropes still meet the 18px
  collar without crossing at the medal edge.
- `.necklace-tag` moved from `top: 6px` to `top: 12px` to clear the collar.
- `backface-visibility` list now names `.necklace-collar` instead of `.necklace-bail`.

