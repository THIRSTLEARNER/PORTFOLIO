import { useEffect, useState } from 'react'

const LINKS = [
  { href: '#about', label: 'About' },
  { href: '#experience', label: 'Journey' },
  { href: '#skills', label: 'Skills' },
  { href: '#projects', label: 'Work' },
  { href: '#contact', label: 'Contact' },
]

export default function Navbar({ name }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24)
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on Escape, and when leaving the mobile breakpoint.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const mq = window.matchMedia('(min-width: 981px)')
    const onBreakpoint = () => setOpen(false)
    window.addEventListener('keydown', onKey)
    mq.addEventListener?.('change', onBreakpoint)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener?.('change', onBreakpoint)
    }
  }, [open])

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`.trim()}>
      <div className="container nav">
        <a className="brand" href="#top" aria-label={`${name} home`} onClick={() => setOpen(false)}>
          {name.split(' ')[0]}
          <span>.</span>
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle-label" aria-hidden="true">{open ? 'Close' : 'Menu'}</span>
          <span className="nav-toggle-bars" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>

        <nav aria-label="Primary" id="primary-nav" className={`primary-nav ${open ? 'is-open' : ''}`.trim()}>
          <ul className="nav-links">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
