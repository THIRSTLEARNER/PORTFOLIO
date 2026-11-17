import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Footer marquee (like tom's marquee-advanced): infinite loop that
 * speeds up with scroll velocity and reacts to scroll direction.
 */
export default function Marquee({ items, className = '' }) {
  const rootRef = useRef(null)
  const trackRef = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    const root = rootRef.current
    if (!track) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const tween = gsap.to(track, {
      xPercent: -50,
      ease: 'none',
      duration: 28,
      repeat: -1,
    })

    let timeout
    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        const abs = Math.abs(self.getVelocity())
        const boost = gsap.utils.clamp(0.7, 2.6, 1 + abs / 2200)
        gsap.to(tween, { timeScale: boost, overwrite: true, duration: 0.35 })
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          gsap.to(tween, { timeScale: 1, duration: 0.7 })
        }, 140)
      },
    })

    const onEnter = () => gsap.to(tween, { timeScale: 0.35, duration: 0.4, overwrite: true })
    const onLeave = () => gsap.to(tween, { timeScale: 1, duration: 0.5, overwrite: true })
    root?.addEventListener('mouseenter', onEnter)
    root?.addEventListener('mouseleave', onLeave)

    return () => {
      clearTimeout(timeout)
      root?.removeEventListener('mouseenter', onEnter)
      root?.removeEventListener('mouseleave', onLeave)
      st.kill()
      tween.kill()
    }
  }, [])

  const repeated = [...items, ...items, ...items, ...items]

  return (
    <div ref={rootRef} className={`marquee ${className}`} aria-hidden="true">
      <div ref={trackRef} className="marquee-track">
        {repeated.map((item, i) => (
          <span key={i} className="marquee-item">
            {item}
            <span className="marquee-star">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
