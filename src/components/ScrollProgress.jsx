import { useEffect, useRef } from 'react'

/**
 * Linear 1-2px scroll progress line fixed to the top edge.
 * Scrubbed (no easing — scroll position is the clock), transform-only.
 */
export default function ScrollProgress() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    let ticking = false
    const update = () => {
      ticking = false
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const ratio = max > 0 ? doc.scrollTop / max : 0
      el.style.transform = `scaleX(${ratio})`
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return <div ref={ref} className="scroll-progress" aria-hidden="true" />
}
