import { useEffect, useMemo, useState } from 'react'

const DEFAULT_IMAGES = [
  {
    alt: 'Profile visual 1',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>
      <defs>
        <linearGradient id='a' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='#0b1028'/><stop offset='100%' stopColor='#1b2554'/>
        </linearGradient>
        <radialGradient id='b' cx='30%' cy='25%' r='60%'>
          <stop offset='0%' stopColor='rgba(125,211,252,.7)'/><stop offset='100%' stopColor='rgba(125,211,252,0)'/>
        </radialGradient>
        <radialGradient id='c' cx='75%' cy='75%' r='55%'>
          <stop offset='0%' stopColor='rgba(167,139,250,.65)'/><stop offset='100%' stopColor='rgba(167,139,250,0)'/>
        </radialGradient>
      </defs>
      <rect width='400' height='400' fill='url(#a)'/>
      <rect width='400' height='400' fill='url(#b)'/>
      <rect width='400' height='400' fill='url(#c)'/>
      <circle cx='200' cy='168' r='62' fill='rgba(234,240,255,.14)' stroke='rgba(125,211,252,.35)'/>
      <path d='M110 330c18-58 52-88 90-88s72 30 90 88' fill='rgba(234,240,255,.12)' stroke='rgba(167,139,250,.28)'/>
      <circle cx='128' cy='118' r='3' fill='#7dd3fc'/><circle cx='286' cy='132' r='2.5' fill='#a78bfa'/><circle cx='305' cy='240' r='2' fill='#22d3ee'/>
    </svg>`,
  },
  {
    alt: 'Profile visual 2',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>
      <defs>
        <linearGradient id='a' x1='1' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#120f2b'/><stop offset='100%' stopColor='#0d2340'/>
        </linearGradient>
        <radialGradient id='b' cx='70%' cy='30%' r='60%'>
          <stop offset='0%' stopColor='rgba(34,211,238,.55)'/><stop offset='100%' stopColor='rgba(34,211,238,0)'/>
        </radialGradient>
      </defs>
      <rect width='400' height='400' fill='url(#a)'/>
      <rect width='400' height='400' fill='url(#b)'/>
      <path d='M200 70l18 52 55 2-43 33 15 53-45-31-45 31 15-53-43-33 55-2z' fill='rgba(125,211,252,.18)' stroke='rgba(125,211,252,.35)'/>
      <circle cx='200' cy='210' r='54' fill='rgba(234,240,255,.13)' stroke='rgba(34,211,238,.3)'/>
      <path d='M125 332c16-52 44-78 75-78s59 26 75 78' fill='rgba(234,240,255,.11)'/>
    </svg>`,
  },
  {
    alt: 'Profile visual 3',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>
      <defs>
        <linearGradient id='a' x1='0' y1='1' x2='1' y2='0'>
          <stop offset='0%' stopColor='#081427'/><stop offset='100%' stopColor='#24164a'/>
        </linearGradient>
        <radialGradient id='b' cx='50%' cy='45%' r='65%'>
          <stop offset='0%' stopColor='rgba(167,139,250,.45)'/><stop offset='100%' stopColor='rgba(167,139,250,0)'/>
        </radialGradient>
      </defs>
      <rect width='400' height='400' fill='url(#a)'/>
      <rect width='400' height='400' fill='url(#b)'/>
      <ellipse cx='200' cy='205' rx='150' ry='72' fill='none' stroke='rgba(125,211,252,.18)' transform='rotate(-18 200 205)'/>
      <ellipse cx='200' cy='205' rx='150' ry='72' fill='none' stroke='rgba(167,139,250,.16)' transform='rotate(18 200 205)'/>
      <circle cx='200' cy='162' r='58' fill='rgba(234,240,255,.14)' stroke='rgba(167,139,250,.32)'/>
      <path d='M118 330c17-56 48-84 82-84s65 28 82 84' fill='rgba(234,240,255,.12)'/>
      <circle cx='92' cy='170' r='2.5' fill='#fff'/><circle cx='312' cy='160' r='2' fill='#7dd3fc'/>
    </svg>`,
  },
]

function toDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export default function ProfileSwitcher({ images, initials = 'RV', interval = 3200 }) {
  const slides = useMemo(() => {
    const src = Array.isArray(images) && images.length ? images : DEFAULT_IMAGES
    return src.map((item) => {
      if (typeof item === 'string') return { src: item, alt: 'Profile image' }
      if (item && item.svg) return { src: toDataUri(item.svg), alt: item.alt || 'Profile image' }
      return { src: item?.src || '', alt: item?.alt || 'Profile image' }
    }).filter((s) => s.src)
  }, [images])

  const [index, setIndex] = useState(0)
  const tiltAllowed =
    typeof window !== 'undefined'
    && window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Auto-advance; the timer resets whenever the slide changes (including taps),
  // so a manual tap never clips an upcoming auto-switch.
  useEffect(() => {
    if (slides.length <= 1) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return undefined
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, interval)
    return () => window.clearInterval(id)
  }, [slides.length, interval, index])

  const slideshow = slides.length > 1
  const primary = (e) => {
    if (!slideshow) {
      // Avatar is decorative for a single photo; only slideshow gets a button role
      return
    }
    e?.preventDefault?.()
    setIndex((i) => (i + 1) % slides.length)
  }

  const onPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--px', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--py', `${e.clientY - rect.top}px`)
  }
  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--px', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--py', `${e.clientY - rect.top}px`)
    if (!tiltAllowed) return
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    e.currentTarget.style.setProperty('--rx', `${(-ny * 8).toFixed(2)}deg`)
    e.currentTarget.style.setProperty('--ry', `${(nx * 9).toFixed(2)}deg`)
  }
  const onPointerLeave = (e) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }

  if (!slides.length) {
    return (
      <div className="avatar-placeholder" aria-label="Profile placeholder">
        {initials}
      </div>
    )
  }

  return (
    <div
      className={`profile-switcher${slideshow ? ' is-interactive' : ''}`}
      role={slideshow ? 'button' : 'img'}
      tabIndex={slideshow ? 0 : undefined}
      aria-label={slideshow ? 'Profile image slideshow. Press to see next image' : 'Profile avatar'}
      onClick={slideshow ? primary : undefined}
      onKeyDown={
        slideshow
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                primary(e)
              }
            }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="profile-ring" aria-hidden="true" />
      <div className="profile-float">
        {slides.map((slide, i) => (
          <img
            key={slide.src + i}
            src={slide.src}
            alt={i === index ? slide.alt : ''}
            className={`profile-slide ${i === index ? 'is-active' : ''}`}
            aria-hidden={i === index ? undefined : true}
            draggable="false"
          />
        ))}
      </div>
      <span className="profile-spotlight" aria-hidden="true" />
    </div>
  )
}
