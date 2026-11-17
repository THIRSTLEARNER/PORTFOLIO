import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import Typewriter from './Typewriter.jsx'
import ProfileSwitcher from './ProfileSwitcher.jsx'
import HeroScroll from './HeroScroll.jsx'
import Necklace from './Necklace.jsx'

const HeroScene = lazy(() => import('./HeroScene.jsx'))

export default function Hero({ data }) {
  const rootRef = useRef(null)
  const [advanceToken, setAdvanceToken] = useState(0)
  const [paused, setPaused] = useState(false)
  const initials = (data.name || 'YN')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const ctx = gsap.context(() => {
      const items = Array.from(el.querySelectorAll('[data-hero-rise]'))
      if (!items.length) return
      gsap.set(items, { y: 42, opacity: 0, filter: 'blur(10px)' })
      gsap.to(items, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.11,
        delay: 0.12,
        clearProps: 'filter',
      })
    }, el)

    return () => ctx.revert()
  }, [])

  // Pointer parallax + device-orientation tilt (mobile/tablet) + idle drift,
  // so the hero feels alive on touch devices, not just with a mouse.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const coarse = window.matchMedia('(pointer: coarse)').matches
    const clamp = (v) => Math.max(-1.1, Math.min(1.1, v))
    const t0 = performance.now()

    let raf = 0
    let tx = 0
    let ty = 0
    let ox = 0
    let oy = 0
    let cx = 0
    let cy = 0
    let orientationAttached = false

    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
      tx = clamp(nx || 0)
      ty = clamp(ny || 0)
    }
    const onLeave = () => {
      tx = 0
      ty = 0
    }
    const onOrientation = (e) => {
      if (e.gamma == null || e.beta == null) return
      ox = clamp(e.gamma / 36)
      oy = clamp((e.beta - 45) / 36)
    }
    const attachOrientation = () => {
      if (orientationAttached) return
      orientationAttached = true
      window.addEventListener('deviceorientation', onOrientation, { passive: true })
    }
    // iOS 13+ requires a user gesture before it will expose orientation events.
    const onPointerDown = () => {
      if (!coarse || typeof DeviceOrientationEvent === 'undefined') return
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then((state) => {
            if (state === 'granted') attachOrientation()
          })
          .catch(() => {})
      } else {
        attachOrientation()
      }
      el.removeEventListener('pointerdown', onPointerDown)
    }

    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const t = (now - t0) / 1000
      const idleX = Math.sin(t * 0.45) * 0.2
      const idleY = Math.cos(t * 0.6) * 0.16
      const targetX = clamp(tx + ox + idleX)
      const targetY = clamp(ty + oy + idleY)
      cx += (targetX - cx) * 0.055
      cy += (targetY - cy) * 0.055
      el.style.setProperty('--hero-px', cx.toFixed(4))
      el.style.setProperty('--hero-py', cy.toFixed(4))
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    raf = requestAnimationFrame(tick)

    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('pointerdown', onPointerDown)
      if (orientationAttached) window.removeEventListener('deviceorientation', onOrientation)
      cancelAnimationFrame(raf)
      el.style.removeProperty('--hero-px')
      el.style.removeProperty('--hero-py')
    }
  }, [])

  return (
    <HeroScroll>
      <section className="hero" id="top" aria-label="Introduction" ref={rootRef}>
        <Suspense fallback={<div className="hero-canvas hero-canvas-fallback" aria-hidden="true" />}>
          <HeroScene className="hero-canvas" />
        </Suspense>
        <div className="hero-overlay" />
        <div className="container hero-content">
          <div className="hero-grid">
            <div className="hero-text">
              <span className="eyebrow" data-hero-rise>
                {data.location}
              </span>
              <h1 className="hero-name" data-hero-rise>
                {data.name}
              </h1>
              <button
                type="button"
                className="hero-role"
                data-hero-rise
                onClick={() => setAdvanceToken((t) => t + 1)}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                aria-label="Switch between Full-Stack Developer and UI/UX Designer"
                title="Click to switch"
              >
                <span aria-hidden="true">
                  <Typewriter texts={[data.role, 'UI/UX Designer']} speed={55} pause={1600} loop={true} paused={paused} advanceToken={advanceToken} reserveWidth={false} className="hero-typing" />
                </span>
              </button>
              <p className="hero-tagline" data-hero-rise>
                {data.tagline}
              </p>
              {data.availability ? (
                <p className="hero-availability" data-hero-rise>
                  <span className="hero-availability-dot" aria-hidden="true" />
                  {data.availability}
                </p>
              ) : null}
              <div className="hero-actions" data-hero-rise>
                <a className="button primary" href="#projects">
                  View work
                </a>
                {data.resumeUrl ? (
                  <a
                    className="button"
                    href={data.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={data.resumeUrl.startsWith('/') ? 'Resume.pdf' : undefined}

                  >
                    Résumé
                  </a>
                ) : null}
                <a className="button" href="#contact">
                  Contact
                </a>
              </div>
            </div>
            <div className="hero-avatar" data-hero-rise aria-hidden={data.profileImages?.length ? undefined : 'true'}>
              <div className="hero-avatar-depth">
                <Necklace>
                  <ProfileSwitcher images={data.profileImages} initials={initials} />
                </Necklace>
              </div>
            </div>
          </div>
        </div>
      </section>
    </HeroScroll>
  )
}
