/**
 * Sticky scroll‑scrubbed hero (like tomdekoning.image‑sequence__sticky):
 * the hero canvas sticks while the text drifts/scales/fades as you scroll away,
 * and the next section overlaps it.
 */
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function HeroScroll({ children }) {
  const rootRef = useRef(null)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const canvas = el.querySelector('.hero-canvas')
    const content = el.querySelector('.hero-content')
    const overlay = el.querySelector('.hero-overlay')

    const ctx = gsap.context(() => {
      if (canvas) {
        gsap.to(canvas, {
          scale: 1.12,
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
      }
      if (content) {
        gsap.to(content, {
          yPercent: -14,
          opacity: 0,
          scale: 0.985,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
      }
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0.92,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
      }
    }, el)

    return () => ctx.revert()
  }, [])

  return <div ref={rootRef}>{children}</div>
}
