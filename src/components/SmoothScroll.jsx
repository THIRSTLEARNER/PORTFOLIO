import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// lets other components stop the scroll (e.g. while the mobile menu is open) —
// body overflow locks break position: sticky, this one doesn't
export const lenisControl = { current: null }

export default function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    })
    lenisControl.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const ticker = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(ticker)
    gsap.ticker.lagSmoothing(0)

    // Anchor links via lenis
    const onClick = (e) => {
      const a = e.target.closest('a[href^="#"]')
      if (!a) return
      const hash = a.getAttribute('href')
      if (!hash || hash === '#') return
      let target = null
      try {
        target = document.querySelector(hash)
      } catch {
        return
      }
      if (target) {
        e.preventDefault()
        lenis.scrollTo(target, { offset: -80, duration: 1.4 })
        history.replaceState(null, '', hash)
        // Preserve skip-link semantics: move focus to the destination when it is focusable.
        if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true })
      }
    }
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      gsap.ticker.remove(ticker)
      lenisControl.current = null
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [])

  return null
}
