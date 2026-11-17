import { useLayoutEffect, useRef } from 'react'

const MAX_ANGLE = 0.92 // radians (~53°) while dragging
const SWING_CLAMP = 1.18 // radians (~68°) hard cap while swinging freely
const SPRING = 6.3 // longer chain = slower, more stately pendulum
const DAMPING = 2.15
const SPIN_SPRING = 26 // looser coin spring — rotates longer before settling
const SPIN_DAMPING = 3.8
const STRETCH_MAX = 96 // px the chain can stretch like a rubber band
const STRETCH_SPRING = 320 // stiff spring — release makes it snap
const STRETCH_DAMPING = 14
const BOB_SPRING = 92 // vertical hop spring for the release jump
const BOB_DAMPING = 7.5

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
  })

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const swing = swingRef.current
    const pendant = pendantRef.current
    const chain = chainRef.current
    if (!swing || !pendant || !chain) return undefined

    // Measure the hero so the chain starts just under the fixed header.
    const measure = () => {
      const hero = document.querySelector('.hero')
      const avatar = swing.closest('.hero-avatar')
      if (!hero || !avatar) return
      const offset = Math.max(80, avatar.getBoundingClientRect().top - hero.getBoundingClientRect().top)
      avatar.style.setProperty('--pivot-offset', `${offset}px`)
      state.current.restLen = offset // keep the physics in sync with the visual anchor
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)

    if (reduce) {
      return () => {
        window.removeEventListener('resize', measure)
        window.removeEventListener('orientationchange', measure)
      }
    }

    let raf = 0
    let last = performance.now()

    const applyStretch = () => {
      const restLen = state.current.restLen
      const stretch = state.current.stretch
      const bobY = state.current.bobY
      // bobY can pull the chain taut (jump upward) — clamp so links never invert
      const len = Math.max(restLen * 0.78, restLen + stretch + bobY)
      chain.style.height = `${len}px`
      pendant.style.top = `${len}px`
    }

    const step = (now) => {
      raf = requestAnimationFrame(step)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = state.current

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
      // Vertical hop spring — the medallion jumps off the pull and bounces back
      const bobAccel = -BOB_SPRING * s.bobY - BOB_DAMPING * s.bobVel
      s.bobVel += bobAccel * dt
      s.bobY += s.bobVel * dt
      if (Math.abs(s.bobY) < 0.35 && Math.abs(s.bobVel) < 4) {
        s.bobY = 0
        s.bobVel = 0
      }
      applyStretch()

      // Medallion coin-spin: elastic spring toward flat-facing
      const spinAccel = -SPIN_SPRING * s.spin - SPIN_DAMPING * s.spinVelocity
      s.spinVelocity += spinAccel * dt
      s.spin += s.spinVelocity * dt
      if (Math.abs(s.spin) < 1e-3 && Math.abs(s.spinVelocity) < 1e-3) {
        s.spin = 0
        s.spinVelocity = 0
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
      if (s.idleClock > 6.5) {
        s.velocity += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.45)
        s.idleClock = 0
      }
      swing.style.transform = `rotate(${s.angle}rad)`
      if (flipRef.current) {
        const tiltX = Math.max(-0.22, Math.min(0.22, s.velocity * 0.09))
        flipRef.current.style.transform = `rotateX(${tiltX.toFixed(4)}rad) rotateY(${s.spin.toFixed(4)}rad)`
      }
    }

    const onPointerDown = (e) => {
      e.preventDefault()
      pendant.setPointerCapture(e.pointerId)
      const rect = swing.getBoundingClientRect()
      const hero = document.querySelector('.hero')
      const avatar = swing.closest('.hero-avatar')
      state.current.cx = rect.left // pivot x (swing is 0-width at avatar centre)
      state.current.cy = rect.top // pivot y — hero top, right under the fixed nav
      if (hero && avatar) {
        state.current.restLen = Math.max(80, avatar.getBoundingClientRect().top - hero.getBoundingClientRect().top)
      }
      state.current.dragging = true
      state.current.velocity = 0
      state.current.stretchVel = 0
      state.current.spinVelocity *= 0.35 // grabbing a spinning medal calms it
      state.current.lastDragX = e.clientX
      state.current.lastDragVelocityH = 0
      state.current.lastDragAngle = Math.atan2(e.clientX - state.current.cx, Math.max(1, e.clientY - state.current.cy))
      state.current.lastDragT = performance.now()
      pendant.classList.add('is-held')
    }

    const onPointerMove = (e) => {
      const s = state.current
      if (!s.dragging) return
      const dx = e.clientX - s.cx
      const dy = e.clientY - s.cy
      let angle = Math.atan2(dx, Math.max(1, dy))
      angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angle))
      const dist = Math.hypot(dx, dy)
      s.stretch = Math.max(0, Math.min(STRETCH_MAX, dist - s.restLen)) // rubber band!
      applyStretch()
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

    const endDrag = () => {
      const s = state.current
      s.dragging = false
      // release with the flick — horizontal px/s becomes coin spin
      s.spinVelocity = Math.max(-12.5, Math.min(12.5, s.lastDragVelocityH * 0.026))
      // the JUMP fires on ANY real pull — chain stretched at all, or a flick with momentum
      if (s.stretch > 4 || Math.abs(s.velocity) > 0.7) {
        s.bobVel = -(560 + Math.min(680, s.stretch * 6 + Math.abs(s.velocity) * 150))
      }
      pendant.classList.remove('is-held')
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
          <radialGradient id="pinBody" cx="50%" cy="36%" r="72%">
            <stop offset="0%" stopColor="#e6feff" />
            <stop offset="24%" stopColor="#7bf3ff" />
            <stop offset="52%" stopColor="#22c9db" />
            <stop offset="80%" stopColor="#1a7396" />
            <stop offset="100%" stopColor="#0a2740" />
          </radialGradient>
        </defs>
        <circle cx="13" cy="13" r="11" fill="url(#pinBody)" stroke="rgba(6,10,14,0.5)" strokeWidth="0.8" />
        <circle cx="13" cy="13" r="7.2" fill="none" stroke="rgba(190,249,255,0.5)" strokeWidth="0.7" />
        <path
          d="M13 6.2l1.9 4.7 5.1.15-3.95 3.2 1.45 4.8L13 16.4l-4.4 2.65 1.45-4.8-3.95-3.2 5.1-.15L13 6.2z"
          fill="#eefdff"
          opacity="0.95"
        />
        <circle cx="9.6" cy="7.6" r="1.15" fill="#bef9ff" opacity="0.98" />
      </svg>
      <div ref={swingRef} className="necklace-swing">
        <div ref={chainRef} className="necklace-chain" aria-hidden="true" />
        <div ref={pendantRef} className="necklace-pendant">
          <div ref={flipRef} className="necklace-flip">
            <div className="necklace-bail" aria-hidden="true" />
            <div className="necklace-tag" aria-hidden="true">RM</div>
            {children}
            <div className="necklace-medal-back" aria-hidden="true">
              <svg viewBox="0 0 240 240" width="100%" height="100%">
                <defs>
                  <radialGradient id="medalBackBody" cx="50%" cy="40%" r="68%">
                    <stop offset="0%" stopColor="#2c1f4e" />
                    <stop offset="45%" stopColor="#1a1030" />
                    <stop offset="100%" stopColor="#070312" />
                  </radialGradient>
                  <path id="medalBackRim" d="M120,36 a84,84 0 1,1 -0.01,0" fill="none" />
                </defs>
                <circle cx="120" cy="120" r="110" fill="#0d071e" />
                <circle cx="120" cy="120" r="101" fill="url(#medalBackBody)" stroke="rgba(124, 94, 214, 0.45)" strokeWidth="1.2" />
                <circle cx="120" cy="120" r="74" fill="none" stroke="rgba(94, 234, 212, 0.35)" strokeWidth="1" strokeDasharray="2.6 3.6" />
                <text className="medal-back-text">
                  <textPath href="#medalBackRim" textLength="526">
                    VILLANUEVA · RAINIER · FULL-STACK DEVELOPER · INTERACTIVE SYSTEMS ·
                  </textPath>
                </text>
                <path
                  d="M120,74 l13.6 33.4 36.4 0.9 -27.9 22.6 10.6 33.5L120,143.4l-32.7 20.8 10.6-33.5 -27.9-22.6 36.4-0.9L120,74z"
                  fill="#7bf3ff"
                  opacity="0.9"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
