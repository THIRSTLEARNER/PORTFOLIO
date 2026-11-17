import { useEffect, useMemo, useRef, useState } from 'react'

function normalize(s) {
  return String(s || '').toLowerCase()
}

async function copyText(text) {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function CommandPalette({ data }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [notice, setNotice] = useState('')
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const items = useMemo(() => {
    const base = [
      { id: 'top', label: 'Home', hint: 'Hero', action: () => (window.location.hash = '#top') },
      { id: 'about', label: 'About', hint: 'Section', action: () => (window.location.hash = '#about') },
      { id: 'experience', label: 'Experience', hint: 'Section', action: () => (window.location.hash = '#experience') },

      { id: 'skills', label: 'Skills', hint: 'Section', action: () => (window.location.hash = '#skills') },
      { id: 'certifications', label: 'Certifications', hint: 'Section', action: () => (window.location.hash = '#certifications') },
      { id: 'projects', label: 'Work', hint: 'Section', action: () => (window.location.hash = '#projects') },
      { id: 'github', label: 'Open source', hint: 'GitHub', action: () => (window.location.hash = '#github') },
      { id: 'approach', label: 'The approach', hint: 'Philosophy', action: () => (window.location.hash = '#approach') },
      { id: 'testimonials', label: 'Testimonials', hint: 'Section', action: () => (window.location.hash = '#testimonials') },
      { id: 'contact', label: 'Contact', hint: 'Section', action: () => (window.location.hash = '#contact') },
    ]

    const actions = [
      {
        id: 'copy-email',
        label: 'Copy email address',
        hint: data?.email || 'Action',
        action: async () => {
          const ok = await copyText(data?.email)
          setNotice(ok ? 'Email copied.' : 'Could not copy email.')
          window.setTimeout(() => setNotice(''), 1800)
        },
      },
      ...(data?.resumeUrl
        ? [
            {
              id: 'resume',
              label: 'Download résumé',
              hint: 'PDF',
              action: () => {
                const a = document.createElement('a')
                a.href = data.resumeUrl
                a.target = '_blank'
                a.rel = 'noopener noreferrer'
                if (data.resumeUrl.startsWith('/')) a.download = 'Resume.pdf'
                document.body.appendChild(a)
                a.click()
                a.remove()
              },
            },
          ]
        : []),
      {
        id: 'scroll-top',
        label: 'Back to top',
        hint: 'Action',
        action: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      },
    ]

    const projects = (data?.projects || []).map((p, i) => ({
      id: `project-${i}`,
      label: p.title,
      hint: (p.stack || []).slice(0, 2).join(' / ') || 'Project',
      action: () => {
        window.location.hash = '#projects'
        const cards = document.querySelectorAll('.project-card')
        cards[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      },
    }))

    const socials = (data?.socials || []).map((s, i) => ({
      id: `social-${i}`,
      label: s.label,
      hint: 'External',
      action: () => window.open(s.href, '_blank', 'noreferrer'),
    }))

    const mail = data?.email
      ? [
          {
            id: 'email',
            label: `Email ${data.name?.split(' ')[0] || ''}`.trim(),
            hint: data.email,
            action: () => (window.location.href = `mailto:${data.email}`),
          },
        ]
      : []

    return [...base, ...actions, ...projects, ...mail, ...socials]
  }, [data])

  const filtered = useMemo(() => {
    const q = normalize(query).trim()
    if (!q) return items
    return items.filter((it) => normalize(it.label).includes(q) || normalize(it.hint).includes(q))
  }, [items, query])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    setQuery('')
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    const prev = document.activeElement
    return () => {
      clearTimeout(t)
      if (prev && prev.focus) prev.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (e.target instanceof Element && !e.target.closest('.command-palette')) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  const run = (item) => {
    if (!item) return
    setOpen(false)
    setTimeout(() => item.action?.(), 0)
  }

  const onInputKeyDown = (e) => {
    if (!filtered.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(filtered[active])
    }
  }

  return (
    <>
      {notice ? <div className="command-notice" role="status" aria-live="polite">{notice}</div> : null}
      <button
        type="button"
        className="command-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="command-trigger-label">Index</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open ? (
        <div className="command-overlay" role="presentation">
          <div className="command-palette" role="dialog" aria-modal="true" aria-label="Site index">
            <div className="command-head">
              <input
                ref={inputRef}
                className="command-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Jump to section, project, or action…"
                aria-label="Search site index"
                autoComplete="off"
                spellCheck="false"
              />
              <span className="command-esc">Esc</span>
            </div>
            <div className="command-list" ref={listRef} role="listbox">
              {filtered.length ? (
                filtered.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`command-item ${i === active ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                  >
                    <span className="command-item-label">{item.label}</span>
                    <span className="command-item-hint">{item.hint}</span>
                  </button>
                ))
              ) : (
                <div className="command-empty">No matches.</div>
              )}
            </div>
            <div className="command-foot">
              <span><kbd>↑↓</kbd> Navigate</span>
              <span><kbd>↵</kbd> Open</span>
              <span><kbd>Esc</kbd> Close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
