import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * data-reveal-group style: children reveal in a staggered group when scrolled into view.
 * Use to wrap a block — direct children animate up + fade with stagger.
 */
export default function RevealGroup({
  children,
  className = '',
  stagger = 0.12,
  duration = 0.8,
  y = 40,
  delay = 0,
  as: Tag = 'div',
}) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const items = el.querySelectorAll('[data-reveal-item]')

    if (reduce || items.length === 0) return undefined

    gsap.set(items, { y, opacity: 0, filter: 'blur(6px)' })

    const tween = gsap.to(items, {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      duration,
      ease: 'power3.out',
      stagger,
      delay,
      clearProps: 'opacity,filter,transform',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    })

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(items, { clearProps: 'all' })
    }
  }, [stagger, duration, y, delay])

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}
