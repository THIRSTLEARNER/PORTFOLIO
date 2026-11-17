import { useLayoutEffect, useEffect, useState, useRef } from 'react'

export default function Typewriter({
  text,
  texts,
  speed = 150,
  pause = 1800,
  loop = true,
  reserveWidth = true,
  paused = false,
  advanceToken = 0,
  className = ''
}) {
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const prevAdvanceRef = useRef(advanceToken)
  const words = Array.isArray(texts) && texts.length ? texts : [text ?? '']
  const wordKey = words.join('\u0001')
  const wordsRef = useRef(words)
  wordsRef.current = words
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '')
  const [display, setDisplay] = useState('')
  const [boxWidth, setBoxWidth] = useState(0)
  const [ready, setReady] = useState(!reserveWidth)
  const iRef = useRef(0)
  const indexRef = useRef(0)
  const deletingRef = useRef(false)
  const loopingRef = useRef(true)
  const rafRef = useRef(0)
  const measureRef = useRef(null)
  const hostRef = useRef(null)
  const phaseRef = useRef('typing')
  const waitTimerRef = useRef(null)

  // Optionally measure width to reduce layout shift (disabled for flowing/hero text).
  useLayoutEffect(() => {
    if (!reserveWidth) {
      setReady(true)
      return undefined
    }
    let cancelled = false
    const measure = () => {
      if (cancelled || !measureRef.current) return
      const w = Math.ceil(measureRef.current.getBoundingClientRect().width)
      const hostW = hostRef.current?.parentElement?.getBoundingClientRect().width
      const next = hostW ? Math.min(w + 8, Math.floor(hostW)) : w + 8
      if (next > 0) {
        setBoxWidth(next)
        setReady(true)
      }
    }

    measure()
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {})
    const ro = typeof ResizeObserver !== 'undefined' && hostRef.current?.parentElement
      ? new ResizeObserver(measure)
      : null
    if (ro && hostRef.current?.parentElement) ro.observe(hostRef.current.parentElement)
    if (ro && measureRef.current) ro.observe(measureRef.current)
    window.addEventListener('resize', measure)
    return () => {
      cancelled = true
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [longest, className, reserveWidth])

  // External "skip to next phrase" trigger: resets the sequence without
  // remounting, so the entrance animation state (GSAP) is preserved.
  useEffect(() => {
    if (advanceToken === prevAdvanceRef.current) return
    prevAdvanceRef.current = advanceToken
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current)
      waitTimerRef.current = null
    }
    indexRef.current = (indexRef.current + 1) % wordsRef.current.length
    iRef.current = 0
    phaseRef.current = 'typing'
    setDisplay('')
  }, [advanceToken])

  useEffect(() => {
    if (!ready) return undefined
    const list = wordsRef.current
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduceMq.matches) {
      setDisplay(list.join(' · '))
      phaseRef.current = 'done'
      return undefined
    }

    loopingRef.current = true
    phaseRef.current = 'typing'
    iRef.current = 0
    indexRef.current = 0
    deletingRef.current = false
    setDisplay('')
    let lastTime = performance.now()

    const loopFrame = (now) => {
      if (!loopingRef.current) return
      const dt = now - lastTime
      lastTime = now
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loopFrame)
        return
      }
      const word = wordsRef.current[indexRef.current] || ''

      if (phaseRef.current === 'typing') {
        iRef.current += dt / speed
        if (iRef.current >= word.length) {
          iRef.current = word.length
          setDisplay(word)
          const isLast = indexRef.current === wordsRef.current.length - 1
          if (!loop && isLast) {
            phaseRef.current = 'done'
            return
          }
          phaseRef.current = 'wait-full'
          waitTimerRef.current = setTimeout(() => {
            if (!loopingRef.current) return
            phaseRef.current = 'deleting'
            waitTimerRef.current = null
          }, pause)
        } else {
          setDisplay(word.slice(0, Math.floor(iRef.current)))
        }
      } else if (phaseRef.current === 'deleting') {
        iRef.current -= dt / (speed / 1.6)
        if (iRef.current <= 0) {
          iRef.current = 0
          setDisplay('')
          phaseRef.current = 'wait-empty'
          waitTimerRef.current = setTimeout(() => {
            if (!loopingRef.current) return
            indexRef.current = (indexRef.current + 1) % wordsRef.current.length
            phaseRef.current = 'typing'
            iRef.current = 0
            deletingRef.current = false
            waitTimerRef.current = null
          }, pause)
        } else {
          setDisplay(word.slice(0, Math.floor(iRef.current)))
        }
      }

      rafRef.current = requestAnimationFrame(loopFrame)
    }

    rafRef.current = requestAnimationFrame(loopFrame)

    return () => {
      loopingRef.current = false
      cancelAnimationFrame(rafRef.current)
      if (waitTimerRef.current) {
        clearTimeout(waitTimerRef.current)
        waitTimerRef.current = null
      }
    }
  }, [wordKey, speed, pause, ready, loop])

  if (!reserveWidth) {
    return (
      <span
        ref={hostRef}
        className={className}
        style={{
          display: 'inline-grid',
          maxWidth: '100%',
          verticalAlign: 'baseline',
          alignItems: 'start'
        }}
      >
        <span
          aria-hidden="true"
          style={{
            gridArea: '1 / 1',
            visibility: 'hidden',
            whiteSpace: 'normal',
            overflowWrap: 'inherit',
            pointerEvents: 'none'
          }}
        >
          {longest}
          <span className="type-cursor" />
        </span>
        <span style={{ gridArea: '1 / 1', whiteSpace: 'normal', overflowWrap: 'inherit' }}>
          <span style={{ visibility: display ? 'visible' : 'hidden' }}>{display || '\u200b'}</span>
          <span className="type-cursor" aria-hidden="true" />
        </span>
      </span>
    )
  }

  return (
    <>
      <span
        ref={hostRef}
        className={className}
        style={{
          width: ready ? `${boxWidth}px` : 'auto',
          minWidth: 0,
          maxWidth: '100%',
          minHeight: '1em',
          lineHeight: 'inherit',
          display: 'inline-block',
          verticalAlign: 'baseline',
          whiteSpace: 'nowrap',
          overflow: 'visible'
        }}
      >
        <span style={{ visibility: display ? 'visible' : 'hidden' }}>{display || '\u200b'}</span>
        <span className="type-cursor" aria-hidden="true" />
      </span>
      <span
        ref={measureRef}
        className={`type-measure ${className}`.trim()}
        aria-hidden="true"
        style={{
          visibility: 'hidden',
          position: 'absolute',
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}
      >
        {longest}
      </span>
    </>
  )
}
