import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * SplitText-style character stagger reveal (like tomdekoning.work [data-stagger-char]).
 * Each char is wrapped in a mask and slides up with rotation + stagger on scroll enter.
 */
export default function StaggerText({
  text,
  as: Tag = 'h2',
  className = '',
  delay = 0,
  stagger = 0.028,
  duration = 0.9,
  mode = 'chars', // 'chars' | 'words'
  triggerStart = 'top 85%',
  once = true,
  style,
}) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const chars = el.querySelectorAll('.st-char')

    if (reduce || chars.length === 0) return undefined

    gsap.set(chars, { yPercent: 115, rotate: 5, opacity: 0 })

    const tween = gsap.to(chars, {
      yPercent: 0,
      rotate: 0,
      opacity: 1,
      duration,
      ease: 'power4.out',
      stagger,
      delay,
      clearProps: 'transform,opacity',
      scrollTrigger: {
        trigger: el,
        start: triggerStart,
        once,
      },
    })

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(chars, { clearProps: 'all' })
    }
  }, [text, delay, stagger, duration, triggerStart, once])

  const renderChars = () => {
    if (mode === 'words') {
      return text.split(' ').map((word, wi) => (
        <span key={wi} className="st-word" aria-hidden="true">
          <span className="st-word-inner">{word}</span>
          {wi < text.split(' ').length - 1 ? ' ' : ''}
        </span>
      ))
    }
    const words = text.split(' ')
    let charIndex = 0
    return words.map((word, wi) => (
      <span key={wi} className="st-word-group" aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
        {Array.from(word).map((ch) => {
          const el = (
            <span key={charIndex} className="st-char-wrap" aria-hidden="true">
              <span className="st-char">{ch}</span>
            </span>
          )
          charIndex += 1
          return el
        })}
        {wi < words.length - 1 ? <span className="st-space"> </span> : null}
      </span>
    ))
  }

  return (
    <Tag ref={ref} className={`stagger-text ${className}`} style={style}>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">{renderChars()}</span>
    </Tag>
  )
}
