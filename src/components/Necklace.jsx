import { useLayoutEffect, useRef } from 'react'

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
const STRETCH_DAMPING = 5.5
const BOB_SPRING = 48 // vertical hop spring for the release jump
const BOB_DAMPING = 4.0
const PULL_RATIO_MAX = 0.62 // cap stretch relative to measured chain length
const MIN_CHAIN_RATIO = 0.78 // chain can never invert on itself
const ROPE_EMBED = 6 // px the rope continues past the rim so both strands meet inside the collar
const LINK_COUNT = 15 // interlocked curb links per strand
const ROPE_POINTS = 11 // simulation nodes per strand
const ROPE_STIFFNESS = 165 // how hard each node chases its draped rest position
const ROPE_DAMPING = 9 // underdamped → the rope keeps waving after a pull
const ROPE_NEIGHBOR = 0.22 // Laplacian smoothing so waves travel along the strands
const ROPE_LAG = 900 // horizontal inertia from the swing, so the rope trails the medal
const MAX_PIVOT = 360 // px the clasp can sit below the hero top (keeps it on screen)
const MIN_PIVOT = 30 // px minimum chain drop, so the clasp can still clear the nav on tiny screens
const CLASP_INSET = 28 // px the clasp stays below the hero top so it never hides behind the nav

// Draped necklace shape in normalized 180×100 space: both strands fall away from
// the clasp at once, hang down the sides, then converge behind the medallion.
// Sampled by the rope simulation (two cubic segments per strand).
const ROPE_CURVES = [
  [
    [90, 0], [56, 6], [20, 26], [16, 52],
    [24, 76], [76, 88], [90, 100],
  ],
  [
    [90, 0], [124, 6], [160, 26], [164, 52],
    [156, 76], [104, 88], [90, 100],
  ],
]

/**
 * Header-anchored necklace: the avatar hangs from a chain whose pivot sits at
 * the top of the hero (just below the fixed site header), so the medallion
 * dangles below the nav down into the hero like a charm on a chain.
 *
 * Interactions:
 *  - drag the medallion: swings it on the pivot like a pendulum
 *  - pull it further: the chain stretches (rubber-band), and on release it
 *    snaps back with extra force — the "it jumps" feel
 *  - flick horizontally: the medallion spins like a coin on the chain and
 *    settles elastically; small drags also tip it (hVel smoothed)
 *
 * Disabled under prefers-reduced-motion.
 */
export default function Necklace({ children, className = '' }) {
  const swingRef = useRef(null)
  const pendantRef = useRef(null)
  const chainRef = useRef(null)
  const flipRef = useRef(null)
  const state = useRef({
    angle: 0,
    velocity: 0,
    spin: 0,
    spinVelocity: 0,
    dragging: false,
    idleClock: 0,
    cx: 0,
    cy: 0,
    lastDragAngle: 0,
    lastDragT: 0,
    lastDragX: 0,
    lastDragVelocityH: 0, // horizontal px/s, exponentially smoothed
    restLen: 300, // px from hero-top pivot to avatar centre (measured)
    stretch: 0,
    stretchVel: 0,
    bobY: 0, // vertical hop offset — negative moves the medallion toward the sky
    bobVel: 0,
    spinTarget: 0, // nearest face (radians, multiple of TAU) the medal settles on
    pointerStartX: 0,
    pointerStartY: 0,
    moved: 0, // total px the pointer travelled this drag (click suppression)
  })

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const swing = swingRef.current
    const pendant = pendantRef.current
    const chain = chainRef.current
    if (!swing || !pendant || !chain) return undefined

    // Cached last-written values — the loop skips every DOM write while nothing has moved.
    const view = { angle: NaN, flip: '', len: NaN }
    let lastRopeLen = null
    let isOffscreen = false
    const necklaceRoot = chain.closest('.necklace')

    const ropeBase = [...chain.querySelectorAll('.necklace-rope-base path')]
    // 30 interlocked curb links (15 per strand), evenly spaced by arc length each frame
    const linkNodes = [...chain.querySelectorAll('.necklace-link')]

    const sampleStrand = (curve, u) => {
      const first = u <= 0.5
      const t = first ? u * 2 : (u - 0.5) * 2
      const o = first ? 0 : 3
      const p0 = curve[o]
      const p1 = curve[o + 1]
      const p2 = curve[o + 2]
      const p3 = curve[o + 3]
      const mt = 1 - t
      const a = mt * mt * mt
      const b = 3 * mt * mt * t
      const c = 3 * mt * t * t
      const d = t * t * t
      return {
        nx: a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        ny: a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
      }
    }

    // A real chain under tension loses its loop curvature: the strands are pulled inward
    // toward the vertical line from the clasp to the medallion. `stretch` drives that morph,
    // asymptotically — at 60px it's half-taut, at ~150px it's fully straight.
    const ropeTension = (stretch) => {
      if (stretch <= 0) return 0
      return stretch / (stretch + 60)
    }

    const ropeCollapse = (stretch) => 1 - 0.87 * ropeTension(stretch)

    const ropeRestPoint = (curve, u, w, h, stretch = 0) => {
      const { nx, ny } = sampleStrand(curve, u)
      const x = (nx / 180) * w
      const collapse = ropeCollapse(stretch)
      return { x: w / 2 + (x - w / 2) * collapse, y: (ny / 100) * h }
    }

    let rope = null

    const initRope = () => {
      const w = chain.getBoundingClientRect().width || 260
      const h = state.current.restLen + ROPE_EMBED
      rope = {
        w,
        strands: ROPE_CURVES.map((curve) =>
          Array.from({ length: ROPE_POINTS }, (_, i) => {
            const u = i / (ROPE_POINTS - 1)
            const r = ropeRestPoint(curve, u, w, h)
            return { u, x: r.x, y: r.y, vx: 0, vy: 0 }
          })
        ),
      }
    }

    const ropePath = (strand) => {
      let d = `M ${strand[0].x.toFixed(2)} ${strand[0].y.toFixed(2)}`
      for (let i = 0; i < strand.length - 1; i++) {
        const p0 = strand[i - 1] || strand[i]
        const p1 = strand[i]
        const p2 = strand[i + 1]
        const p3 = strand[i + 2] || p2
        d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)}`
        d += ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)}`
        d += ` ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
      }
      return d
    }

    const renderRope = (len) => {
      if (!rope) return
      const h = len + ROPE_EMBED
      const cx = rope.w / 2
      rope.strands.forEach((strand, index) => {
        strand[0].x = cx
        strand[0].y = 0
        const last = strand[strand.length - 1]
        last.x = cx
        last.y = h
        const d = ropePath(strand)
        // string differs from last render → only then touch the DOM
        if (strand._d !== d) {
          strand._d = d
          ropeBase[index].setAttribute('d', d)
        }
        // distribute links evenly along the *arc length* of the simulated strand —
        // even spacing no matter how the nodes bunch up on curves or under stretch
        let total = 0
        const cum = [0]
        for (let n = 1; n < strand.length; n++) {
          total += Math.hypot(strand[n].x - strand[n - 1].x, strand[n].y - strand[n - 1].y)
          cum.push(total)
        }
        const sampleAt = (dist) => {
          let lo = 0, hi = cum.length - 1
          while (lo < hi) {
            const m = (lo + hi) >> 1
            if (cum[m] < dist) lo = m + 1
            else hi = m
          }
          const ii = Math.max(1, lo)
          const a = strand[ii - 1], b = strand[ii]
          const seg = cum[ii] - cum[ii - 1] || 1
          const t = (dist - cum[ii - 1]) / seg
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
        }
        const noise = (seed) => ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1 - 0.5 // deterministic per-link jitter
        for (let k = 0; k < LINK_COUNT; k++) {
          const pos = sampleAt(((k + 0.5) / LINK_COUNT) * total)
          const link = linkNodes[index * LINK_COUNT + k]
          const flip = k % 2 === 1
          const seed = index * LINK_COUNT + k
          const rotJ = noise(seed * 2 + 1) * 13 // ±6.5° — real chain links never hang perfectly aligned
          const scaleJ = 1 + noise(seed * 2 + 2) * 0.09 // ±4.5% — no two links alike
          const t2 = `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)}) rotate(${(pos.ang + rotJ).toFixed(2)})${flip ? ' scale(0.72 0.8)' : ''} scale(${scaleJ.toFixed(3)})`
          if (link._t !== t2) {
            link._t = t2
            link.setAttribute('transform', t2)
            link.querySelector('.necklace-link-body')?.setAttribute('fill', flip ? 'url(#necklaceLinkFlip)' : 'url(#necklaceLink)')
          }
        }
      })
    }

    const snapRope = (len, stretch = 0) => {
      if (!rope) return
      const h = len + ROPE_EMBED
      rope.strands.forEach((strand, index) => {
        strand.forEach((p) => {
          const r = ropeRestPoint(ROPE_CURVES[index], p.u, rope.w, h, stretch)
          p.x = r.x
          p.y = r.y
          p.vx = 0
          p.vy = 0
        })
      })
      renderRope(len)
    }

    const stepRope = (len, dt, swingVelocity, stretch = 0) => {
      if (!rope) return
      const h = len + ROPE_EMBED
      // remember where every node sat so we can tell "settled" from "moving"
      const flat = rope.strands.flat()
      const wasX = new Float64Array(flat.length)
      const wasY = new Float64Array(flat.length)
      for (let i = 0; i < flat.length; i++) {
        wasX[i] = flat[i].x
        wasY[i] = flat[i].y
      }
      rope.strands.forEach((strand, index) => {
        const curve = ROPE_CURVES[index]
        for (let i = 1; i < strand.length - 1; i++) {
          const p = strand[i]
          const r = ropeRestPoint(curve, p.u, rope.w, h, stretch)
          // lateral inertia: the middle of each strand trails the swinging medal
          const lag = swingVelocity * ROPE_LAG * Math.sin(Math.PI * p.u)
          p.vx += (ROPE_STIFFNESS * (r.x - p.x) - ROPE_DAMPING * p.vx + lag) * dt
          p.vy += (ROPE_STIFFNESS * (r.y - p.y) - ROPE_DAMPING * p.vy) * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
        }
        // neighbour smoothing: waves travel down the rope instead of nodes acting alone
        for (let i = 1; i < strand.length - 1; i++) {
          const a = strand[i - 1]
          const b = strand[i]
          const c = strand[i + 1]
          b.x += ((a.x + c.x) / 2 - b.x) * ROPE_NEIGHBOR
          b.y += ((a.y + c.y) / 2 - b.y) * ROPE_NEIGHBOR
        }
      })
      // settled cloth costs nothing — skip the string maths and the DOM entirely
      let moved = lastRopeLen === null || Math.abs(len - lastRopeLen) > 0.01
      if (!moved) {
        let maxDelta = 0
        for (let i = 0; i < flat.length; i++) {
          const dx = Math.abs(flat[i].x - wasX[i])
          const dy = Math.abs(flat[i].y - wasY[i])
          if (dx > maxDelta) maxDelta = dx
          if (dy > maxDelta) maxDelta = dy
          if (maxDelta > 0.02) break
        }
        moved = maxDelta > 0.02
      }
      if (moved) {
        lastRopeLen = len
        renderRope(len)
      }
    }

    const applyPull = () => {
      const s = state.current
      // bobY can pull the chain taut (jump upward) — clamp so links never invert
      const len = Math.max(s.restLen * MIN_CHAIN_RATIO, s.restLen + s.stretch + s.bobY)
      // Medal moves with translate3d (composite-only); skip the write when nothing changed
      if (len !== view.len) {
        view.len = len
        pendant.style.transform = `translate3d(-50%, ${(len - s.restLen).toFixed(2)}px, 0)`
      }
      return len
    }

    // Drop is measured from the hero's top edge using layout offsets, never
    // rects: the entrance animation (transform y: 42) moves the medallion visually
    // but not in the layout, so this stays correct at rest.
    const readPivot = () => {
      const hero = document.querySelector('.hero')
      const avatar = swing.closest('.hero-avatar')
      if (!hero || !avatar) return state.current.restLen
      let top = 0
      let el = avatar
      while (el && el !== hero) {
        top += el.offsetTop
        el = el.offsetParent
      }
      return Math.min(MAX_PIVOT, Math.max(MIN_PIVOT, top - CLASP_INSET))
    }

    // Measure the hero so the chain starts just under the fixed header.
    const measure = () => {
      const hero = document.querySelector('.hero')
      const avatar = swing.closest('.hero-avatar')
      if (!hero || !avatar) return
      const offset = readPivot()
      // set it on the necklace itself: its own --pivot-offset default would win over inheritance
      const root = chain.closest('.necklace')
      if (root) root.style.setProperty('--pivot-offset', `${offset}px`)
      state.current.restLen = offset // keep the physics in sync with the visual anchor
      chain.style.height = `${offset + ROPE_EMBED}px` // layout write happens here only, not per frame
      initRope()
      snapRope(applyPull(), state.current.stretch)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    // the hero re-centres once web fonts and the profile image arrive — re-measure then
    window.addEventListener('load', measure)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure())

    // Pause the necklace entirely once the hero has scrolled past — no decorative loops, no sim
    let observer = null
    if (typeof IntersectionObserver !== 'undefined' && necklaceRoot) {
      observer = new IntersectionObserver(
        ([entry]) => {
          isOffscreen = !entry.isIntersecting
          necklaceRoot.classList.toggle('is-offscreen', isOffscreen)
        },
        { rootMargin: '120px' },
      )
      observer.observe(necklaceRoot)
    }

    if (reduce) {
      return () => {
        window.removeEventListener('resize', measure)
        window.removeEventListener('orientationchange', measure)
        window.removeEventListener('load', measure)
        observer?.disconnect()
        necklaceRoot.classList.remove('is-offscreen')
      }
    }

    let raf = 0
    let last = performance.now()

    const step = (now) => {
      raf = requestAnimationFrame(step)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = state.current

      // scrolled far past the hero — skip the frame entirely, the loop resumes on scroll-in
      if (isOffscreen) return

      if (s.dragging) {
        // The pointer owns the pose mid-drag — integrating the springs here
        // fights the gesture and reads as the chain "shaking". Hold everything.
        if (flipRef.current) flipRef.current.style.transform = `rotateY(${s.spin.toFixed(4)}rad)`
        return
      }

      // Chain stretch spring (post-release only)
      const stretchAccel = -STRETCH_SPRING * s.stretch - STRETCH_DAMPING * s.stretchVel
      s.stretchVel += stretchAccel * dt
      s.stretch += s.stretchVel * dt
      if (s.stretch < 0) {
        s.stretch = 0
        s.stretchVel = Math.abs(s.stretchVel) * 0.35 // tiny bounce off the rest stop
      }
      if (Math.abs(s.stretch) < 0.02 && Math.abs(s.stretchVel) < 0.5) {
        s.stretch = 0
        s.stretchVel = 0
      }
      // Vertical hop spring — the medallion jumps off the pull and bounces back
      const bobAccel = -BOB_SPRING * s.bobY - BOB_DAMPING * s.bobVel
      s.bobVel += bobAccel * dt
      s.bobY += s.bobVel * dt
      if (Math.abs(s.bobY) < 0.35 && Math.abs(s.bobVel) < 4) {
        s.bobY = 0
        s.bobVel = 0
      }
      const len = applyPull()

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

      const accel = -SPRING * Math.sin(s.angle) - DAMPING * s.velocity
      s.velocity += accel * dt
      s.angle += s.velocity * dt
      if (s.angle > SWING_CLAMP) {
        s.angle = SWING_CLAMP
        s.velocity = Math.min(s.velocity, 0)
      } else if (s.angle < -SWING_CLAMP) {
        s.angle = -SWING_CLAMP
        s.velocity = Math.max(s.velocity, 0)
      }
      if (Math.abs(s.angle) < 1e-4 && Math.abs(s.velocity) < 1e-4) {
        s.angle = 0
        s.velocity = 0
      }
      s.idleClock += dt
      if (s.idleClock > 8.5) {
        s.velocity += (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5)
        s.idleClock = 0
      }
      if (s.angle !== view.angle) {
        swing.style.transform = `rotate(${s.angle}rad)`
        view.angle = s.angle
      }
      if (flipRef.current) {
        const tiltX = Math.max(-0.22, Math.min(0.22, s.velocity * 0.09))
        const flip = `rotateX(${tiltX.toFixed(4)}rad) rotateY(${s.spin.toFixed(4)}rad)`
        if (flip !== view.flip) {
          flipRef.current.style.transform = flip
          view.flip = flip
        }
      }
      // Rope is simulated, not posed: it sags, trails the swing and wobbles on release.
      stepRope(len, dt, s.velocity, s.stretch)
    }

    const onPointerDown = (e) => {
      e.preventDefault()
      pendant.setPointerCapture(e.pointerId)
      const rect = swing.getBoundingClientRect()
      state.current.cx = rect.left + rect.width / 2 // pivot x — centre of the anchor
      state.current.cy = rect.top // pivot y
      state.current.restLen = readPivot()
      state.current.dragging = true
      state.current.velocity = 0
      state.current.stretchVel = 0
      state.current.spinVelocity *= 0.35 // grabbing a spinning medal calms it
      state.current.lastDragX = e.clientX
      state.current.lastDragVelocityH = 0
      state.current.lastDragAngle = Math.atan2(state.current.cx - e.clientX, Math.max(1, e.clientY - state.current.cy))
      state.current.lastDragT = performance.now()
      state.current.pointerStartX = e.clientX
      state.current.pointerStartY = e.clientY
      state.current.moved = 0
      state.current.spinTarget = state.current.spin
      pendant.classList.add('is-held')
    }

    const onPointerMove = (e) => {
      const s = state.current
      if (!s.dragging) return
      const dx = e.clientX - s.cx
      const dy = e.clientY - s.cy
      const dxStep = e.clientX - s.lastDragX // px moved since last move event
      s.spin -= dxStep * SPIN_DRAG // drag left/right turns the coin 1:1
      s.spinTarget = s.spin // hold the pose while the pointer owns it
      s.moved = Math.max(s.moved, Math.hypot(e.clientX - s.pointerStartX, e.clientY - s.pointerStartY))
      let angle = Math.atan2(s.cx - e.clientX, Math.max(1, e.clientY - s.cy))
      angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angle))
      const dist = Math.hypot(dx, dy)
      const stretchCap = Math.min(STRETCH_MAX, s.restLen * PULL_RATIO_MAX)
      s.stretch = Math.max(0, Math.min(stretchCap, dist - s.restLen)) // rubber band!
      snapRope(applyPull(), s.stretch)
      const now = performance.now()
      const dt = (now - s.lastDragT) / 1000
      if (dt > 0.003) {
        const rawVelocity = (angle - s.lastDragAngle) / dt
        s.velocity = Math.max(-9, Math.min(9, rawVelocity)) // cap drag flick so release can't fling the pendant overhead
        const rawH = (e.clientX - s.lastDragX) / dt // px per second
        s.lastDragVelocityH = s.lastDragVelocityH * 0.62 + rawH * 0.38 // smoothed — small drags count too
      }
      s.lastDragX = e.clientX
      s.lastDragAngle = angle
      s.lastDragT = now
      s.angle = angle
      swing.style.transform = `rotate(${s.angle}rad)`
    }

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
      // whip the rope so it keeps travelling after the throw (the sim damps it out)
      if (rope) {
        const kick = Math.max(-1500, Math.min(1500, -s.lastDragVelocityH * 0.6))
        const pluck = Math.min(1500, s.stretch * 3.6) // vertical pluck — the tether recoils up
        for (const strand of rope.strands) {
          for (let i = 1; i < strand.length; i++) {
            const p = strand[i]
            const w = Math.sin(Math.PI * p.u)
            if (Math.abs(kick) > 1) p.vx += kick * w
            if (pluck > 1) p.vy += pluck * w * 0.55
          }
        }
      }
      // A drag is not a tap: swallow the click that would otherwise advance the slideshow
      if (e && typeof e.clientX === 'number' && s.moved > 6) {
        const swallow = (ev) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        window.addEventListener('click', swallow, { capture: true, once: true })
      }
    }

    pendant.addEventListener('pointerdown', onPointerDown)
    pendant.addEventListener('pointermove', onPointerMove)
    pendant.addEventListener('pointerup', endDrag)
    pendant.addEventListener('pointercancel', endDrag)
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      window.removeEventListener('load', measure)
      observer?.disconnect()
      necklaceRoot.classList.remove('is-offscreen')
      pendant.removeEventListener('pointerdown', onPointerDown)
      pendant.removeEventListener('pointermove', onPointerMove)
      pendant.removeEventListener('pointerup', endDrag)
      pendant.removeEventListener('pointercancel', endDrag)
    }
  }, [])

  return (
    <div className={`necklace ${className}`}>
      <svg className="necklace-pin" viewBox="0 0 26 26" width="21" height="21" aria-hidden="true">
        <defs>
          <radialGradient id="claspBody" cx="42%" cy="33%" r="74%">
            <stop offset="0%" stopColor="#fffbe0" />
            <stop offset="16%" stopColor="#ffd968" />
            <stop offset="44%" stopColor="#d9a441" />
            <stop offset="74%" stopColor="#8a5a1e" />
            <stop offset="100%" stopColor="#241204" />
          </radialGradient>
        </defs>
        <circle cx="13" cy="13" r="11.3" fill="url(#claspBody)" stroke="rgba(4, 4, 6, 0.6)" strokeWidth="0.7" />
        <circle cx="13" cy="13" r="8.7" fill="none" stroke="rgba(255, 244, 214, 0.42)" strokeWidth="0.7" />
        {/* original gothic heart */}
        <path
          d="M13 17.6c-3.4-2.6-5.1-4.9-5.1-7.2 0-2 1.5-3.4 3.1-3.4 0.9 0 1.7 0.5 2 1.3 0.3-0.8 1.1-1.3 2-1.3 1.6 0 3.1 1.4 3.1 3.4 0 2.3-1.7 4.6-5.1 7.2z"
          fill="#ffe9b0"
          opacity="0.92"
        />
        <circle cx="8.7" cy="7.2" r="1.1" fill="#fffbe6" opacity="0.98" />
      </svg>
      <div ref={swingRef} className="necklace-swing">
        <div ref={chainRef} className="necklace-chain" aria-hidden="true">
          <svg className="necklace-rope" focusable="false">
            <defs>
              {/* oxidized sterling, not chrome — desaturated, pitted, cold */}
              <linearGradient id="necklaceLink" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e2e4e8" />
                <stop offset="20%" stopColor="#b0b5bd" />
                <stop offset="44%" stopColor="#6d747e" />
                <stop offset="62%" stopColor="#373c45" />
                <stop offset="80%" stopColor="#151920" />
                <stop offset="100%" stopColor="#04060b" />
              </linearGradient>
              <linearGradient id="necklaceLinkFlip" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c4c8ce" />
                <stop offset="30%" stopColor="#7d838d" />
                <stop offset="56%" stopColor="#2d313a" />
                <stop offset="80%" stopColor="#10131a" />
                <stop offset="100%" stopColor="#05070c" />
              </linearGradient>
            </defs>
            <g className="necklace-rope-base">
              <path d="" />
              <path d="" />
            </g>
            {/* hollow curb washers — like the real thing: dark void, rolled over edge */}
            <g className="necklace-chain-links">
              {Array.from({ length: LINK_COUNT * 2 }, (_, i) => (
                <g key={i} className="necklace-link">
                  <ellipse className="necklace-link-body" rx="12.6" ry="6.9" />
                  <ellipse className="necklace-link-hole" rx="7.9" ry="3.4" />
                  <path className="necklace-link-highlight" d="M -12.6 0 A 12.6 6.9 0 0 0 12.6 0" />
                  <path className="necklace-link-shadow" d="M -12.6 0 A 12.6 6.9 0 0 1 12.6 0" />
                </g>
              ))}
            </g>
          </svg>
        </div>
        <div ref={pendantRef} className="necklace-pendant">
          <div ref={flipRef} className="necklace-flip">
            <div className="necklace-collar" aria-hidden="true" />
            <span className="necklace-rim" aria-hidden="true" />
            <span className="necklace-shine" aria-hidden="true" />
            <span className="necklace-reed" aria-hidden="true" />
            <span className="necklace-glint" aria-hidden="true" />
            {children}
            <div className="necklace-medal-back" aria-hidden="true">
              <svg viewBox="0 0 240 240" width="100%" height="100%">
                <defs>
                  <radialGradient id="medalBackBody" cx="50%" cy="40%" r="68%">
                    <stop offset="0%" stopColor="#2c1f4e" />
                    <stop offset="45%" stopColor="#1a1030" />
                    <stop offset="100%" stopColor="#070312" />
                  </radialGradient>
                  <radialGradient id="crossGrad" cx="50%" cy="28%" r="80%">
                    <stop offset="0%" stopColor="#fff7d8" />
                    <stop offset="30%" stopColor="#ffd968" />
                    <stop offset="60%" stopColor="#c9922e" />
                    <stop offset="85%" stopColor="#6b4a12" />
                    <stop offset="100%" stopColor="#1c1004" />
                  </radialGradient>
                  <path id="medalBackRim" d="M120,36 a84,84 0 1,1 -0.01,0" fill="none" />
                </defs>
                <circle cx="120" cy="120" r="110" fill="#0d071e" />
                <circle cx="120" cy="120" r="101" fill="url(#medalBackBody)" stroke="rgba(124, 94, 214, 0.45)" strokeWidth="1.2" />
                <circle cx="120" cy="120" r="74" fill="none" stroke="rgba(190, 249, 255, 0.28)" strokeWidth="1" strokeDasharray="2.6 3.6" />
                <text className="medal-back-text">
                  <textPath href="#medalBackRim" textLength="526">
                    VILLANUEVA · RAINIER · FULL-STACK DEVELOPER · INTERACTIVE SYSTEMS ·
                  </textPath>
                </text>
                {/* original flared gothic cross */}
                <path
                  d="M114 66h12v30h22l4 10-4 10h-22v30h-12V116H92l-4-10 4-10h22z"
                  fill="url(#crossGrad)"
                  stroke="#1a0f02"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  opacity="0.96"
                />
                <circle cx="120" cy="106" r="4.4" fill="#fff7d8" opacity="0.85" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
