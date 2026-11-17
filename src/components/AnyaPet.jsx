import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const CALM_SRC = '/images/anya-calm.png'
const EXCITED_SRC = '/images/anya-excited.png'
const SCARED_SRC = '/images/anya3.png'
const BOOPS_KEY = 'anya:boops'
const HIDDEN_KEY = 'anya:hidden'
const POS_KEY = 'anya:pos'

const CATCHPHRASES = ['nya!', 'WAKU WAKU!', 'hehehe', 'peanut!', '*boop*', 'nyanya~']
const WANDER_SPEED = 0.045 // px per ms — an unhurried stroll

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export default function AnyaPet() {
  const [hidden, setHidden] = useState(() => readStored(HIDDEN_KEY, false))
  const [face, setFace] = useState('calm')
  const [bubble, setBubble] = useState(null)
  const [burst, setBurst] = useState(0)
  const [boops, setBoops] = useState(() => Number(readStored(BOOPS_KEY, 0)) || 0)

  const wrapRef = useRef(null)
  const petRef = useRef(null)
  const pos = useRef({ x: null, y: null })
  const dir = useRef(1)
  const nextTurn = useRef(0)
  const bobOffset = useRef(Math.random() * Math.PI * 2)
  const dragState = useRef(null)
  const moved = useRef(0)
  const faceTimer = useRef(null)
  const bubbleTimer = useRef(null)
  const lastActivity = useRef(0)
  const pulse = useRef(0)
  const faceHoldUntil = useRef(0) // keep deliberate faces (boop / scared) up this long
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const say = useCallback((text) => {
    setBubble({ id: Date.now(), text })
    window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 1800)
  }, [])

  const showFace = useCallback((next, duration) => {
    setFace(next)
    faceHoldUntil.current = performance.now() + duration
    window.clearTimeout(faceTimer.current)
    faceTimer.current = window.setTimeout(() => setFace('calm'), duration)
  }, [])

  // Passive reaction to activity anywhere: she puffs up and flicks to the
  // star-eyes face. Silent by design — no bubbles, no announcements.
  const poke = useCallback(() => {
    if (reducedMotion.current || dragState.current) return
    lastActivity.current = performance.now()
    pulse.current = Math.min(1, pulse.current + 0.5)
    setFace('excited')
  }, [])

  const boop = useCallback(() => {
    const next = boops + 1
    setBoops(next)
    try {
      localStorage.setItem(BOOPS_KEY, String(next))
    } catch {
      // storage unavailable — boops are just not persisted
    }
    showFace('excited', 1800)
    say(next % 5 === 0 ? 'WAKU WAKU x' + next + '!' : CATCHPHRASES[Math.floor(Math.random() * CATCHPHRASES.length)])
    if (!reducedMotion.current) setBurst((n) => n + 1)
  }, [boops, say, showFace])

  // Position + wander loop. Initial placement happens in a layout effect so the
  // pet never flashes at the wrong spot; the stroll itself is skipped when the
  // user prefers reduced motion, leaving a static, boopable sticker.
  useLayoutEffect(() => {
    if (hidden) return undefined
    const el = petRef.current
    const wrap = wrapRef.current
    if (!el || !wrap) return undefined

    const size = el.offsetWidth || 96
    const stored = readStored(POS_KEY, null)
    const maxX = Math.max(0, window.innerWidth - size)
    const maxY = Math.max(0, window.innerHeight - size)
    pos.current = stored
      ? { x: Math.min(Math.max(0, stored.x), maxX), y: Math.min(Math.max(0, stored.y), maxY) }
      : { x: 20, y: maxY - 20 }
    nextTurn.current = performance.now() + 2500 + Math.random() * 3000
    const apply = () => {
      wrap.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`
    }
    apply()

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = () => {
      reducedMotion.current = mq.matches
    }
    mq.addEventListener('change', onMotionChange)

    if (reducedMotion.current) {
      return () => mq.removeEventListener('change', onMotionChange)
    }

    let raf = 0
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min(50, now - last)
      last = now
      if (!dragState.current) {
        if (now >= nextTurn.current) {
          const roll = Math.random()
          dir.current = roll < 0.15 ? 0 : roll < 0.575 ? -1 : 1 // sometimes just lingers
          nextTurn.current = now + 2500 + Math.random() * 4000
        }
        pos.current.x += dir.current * WANDER_SPEED * dt
        if (pos.current.x <= 0) {
          pos.current.x = 0
          dir.current = 1
        } else if (pos.current.x >= maxX) {
          pos.current.x = maxX
          dir.current = -1
        }
        bobOffset.current += dt * 0.006
      }
      pulse.current = Math.max(0, pulse.current - dt * 0.0022)
      if (
        !dragState.current &&
        lastActivity.current > 0 &&
        now - lastActivity.current > 900 &&
        now > faceHoldUntil.current
      ) {
        lastActivity.current = 0
        setFace('calm')
      }
      const bob = Math.sin(bobOffset.current) * 3
      const scale = 1 + pulse.current * 0.16
      wrap.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y + bob}px, 0) scale(${scale.toFixed(3)})`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      mq.removeEventListener('change', onMotionChange)
      cancelAnimationFrame(raf)
    }
  }, [hidden])

  // The contact form announces its wins through the site — Anya celebrates.
  useEffect(() => {
    if (hidden) return undefined
    const onCelebrate = () => {
      showFace('excited', 2400)
      if (!reducedMotion.current) {
        setBurst((n) => n + 1)
        say('yatta!')
      }
    }
    window.addEventListener('anya:celebrate', onCelebrate)
    return () => window.removeEventListener('anya:celebrate', onCelebrate)
  }, [hidden, say, showFace])

  // Occasional "please pet me"
  useEffect(() => {
    if (hidden) return undefined
    const id = window.setInterval(() => {
      if (document.hidden || dragState.current || face === 'excited') return
      showFace('excited', 2200)
      say('pet me!')
    }, 45000)
    return () => window.clearInterval(id)
  }, [hidden, face, say, showFace])

  // React to typing (printable keys, no modifiers) and clicks anywhere that
  // isn't the pet itself (boop handles pet clicks).
  useEffect(() => {
    if (hidden) return undefined
    const onKeydown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.length !== 1) return
      poke()
    }
    const onPointerdown = (event) => {
      if (event.target instanceof Element && event.target.closest('.anya-pet-wrap')) return
      poke()
    }
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('pointerdown', onPointerdown, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('pointerdown', onPointerdown)
    }
  }, [hidden, poke])

  useEffect(() => () => {
    window.clearTimeout(faceTimer.current)
    window.clearTimeout(bubbleTimer.current)
  }, [])

  const onPointerDown = (event) => {
    const wrap = wrapRef.current
    const el = petRef.current
    if (!wrap || !el) return
    if (pos.current.x == null) {
      pos.current = { x: 0, y: 0 }
    }
    moved.current = 0
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.current.x,
      originY: pos.current.y,
    }
    el.setPointerCapture(event.pointerId)
    wrap.classList.add('is-dragging')
    window.clearTimeout(faceTimer.current)
    faceHoldUntil.current = Number.MAX_VALUE
    setFace('scared')
  }

  const onPointerMove = (event) => {
    const drag = dragState.current
    if (!drag) return
    const size = petRef.current?.offsetWidth || 96
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    moved.current = Math.max(moved.current, Math.hypot(dx, dy))
    pos.current.x = Math.min(Math.max(0, drag.originX + dx), Math.max(0, window.innerWidth - size))
    pos.current.y = Math.min(Math.max(0, drag.originY + dy), Math.max(0, window.innerHeight - size))
    if (wrapRef.current) wrapRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`
  }

  const endDrag = () => {
    if (!dragState.current) return
    dragState.current = null
    wrapRef.current?.classList.remove('is-dragging')
    faceHoldUntil.current = 0
    setFace('calm')
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos.current))
    } catch {
      // ignore storage failures
    }
  }

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDDEN_KEY, 'true')
    } catch {
      // ignore storage failures
    }
  }

  const restore = () => {
    setHidden(false)
    setFace('calm')
    try {
      localStorage.setItem(HIDDEN_KEY, 'false')
      localStorage.removeItem(POS_KEY)
    } catch {
      // ignore storage failures
    }
  }

  if (hidden) {
    return (
      <button type="button" className="anya-restore" onClick={restore} aria-label="Restore Anya, your site pet">
        Restore Anya
      </button>
    )
  }

  return (
    <div ref={wrapRef} className="anya-pet-wrap">
      <div
        ref={petRef}
        className="anya-pet"
        role="button"
        tabIndex={0}
        aria-label={`Boop Anya, your site pet. ${boops} boops so far`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (moved.current > 6) return // that was a drag, not a boop
          boop()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            boop()
          }
        }}
      >
        <img
          key={face}
          className="anya-sprite"
          src={face === 'excited' ? EXCITED_SRC : face === 'scared' ? SCARED_SRC : CALM_SRC}
          alt=""
          draggable={false}
          width={512}
          height={512}
        />
        {bubble ? (
          <span key={bubble.id} className="anya-bubble" role="status">
            {bubble.text}
          </span>
        ) : null}
        {burst > 0 ? (
          <span key={burst} className="anya-hearts" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <svg
                key={i}
                className="anya-heart"
                style={{
                  '--dx': `${(i - 2.5) * 22}px`,
                  '--r': `${-22 + i * 9}deg`,
                  '--delay': `${i * 45}ms`,
                }}
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="#ff6b9d"
              >
                <path d="M12 21s-7.5-4.9-10-9.3C.4 8.4 2.6 5 6.3 5c2.2 0 3.9 1.2 5.7 3.4C13.8 6.2 15.5 5 17.7 5c3.7 0 5.9 3.4 4.3 6.7-2.5 4.3-10 9.3-10 9.3z" />
              </svg>
            ))}
          </span>
        ) : null}
      </div>
      <button type="button" className="anya-hide" aria-label="Hide Anya pet" onClick={hide}>
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M4 4l8 8" />
          <path d="M12 4l-8 8" />
        </svg>
      </button>
    </div>
  )
}
