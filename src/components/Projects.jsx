import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

const MilkyWay = lazy(() => import('./MilkyWay.jsx'))

function isVideoSrc(src = '') {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(src)
}

function siteHost(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function ProjectMedia({ project, mode = 'card', active = false }) {
  const [reduceMotion, setReduceMotion] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const src = project.video || project.preview || project.image || ''
  const poster = project.poster || (project.video || project.preview ? project.image : '') || ''
  const video = Boolean(project.video || project.preview) || isVideoSrc(src)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (mode === 'modal' && !reduceMotion) {
      const p = el.play()
      if (p && p.catch) p.catch(() => {})
    } else if (!active && !scrubbing) {
      el.pause()
    }
  }, [mode, active, scrubbing, reduceMotion, src])

  const onMove = (e) => {
    if (mode !== 'card' || !video || reduceMotion) return
    const wrap = wrapRef.current
    const el = videoRef.current
    if (!wrap || !el || !Number.isFinite(el.duration) || el.duration <= 0) return
    const rect = wrap.getBoundingClientRect()
    const x = Math.min(Math.max(0, e.clientX - rect.left), Math.max(1, rect.width))
    const ratio = x / Math.max(1, rect.width)
    try {
      el.currentTime = ratio * el.duration
    } catch {
      // ignore seek errors before metadata is ready
    }
  }

  const onEnter = () => {
    if (mode !== 'card' || !video || reduceMotion) return
    setScrubbing(true)
  }

  const onLeave = () => {
    if (mode !== 'card') return
    setScrubbing(false)
    const el = videoRef.current
    if (el) {
      el.pause()
      try { el.currentTime = 0 } catch {}
    }
  }

  if (src && video && !reduceMotion) {
    return (
      <div
        ref={wrapRef}
        className={`project-media ${mode === 'card' ? 'is-scrubbable' : ''}`}
        onPointerMove={onMove}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <video
          ref={videoRef}
          className="project-image project-video"
          src={src}
          poster={poster || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`${project.title} preview`}
        />
        {mode === 'card' ? <span className="project-media-hint" aria-hidden="true">Move to preview</span> : null}
      </div>
    )
  }

  if (poster || (src && !video)) {
    const imageSrc = poster || src
    const host = siteHost(project.href)
    const fit = mode === 'modal' ? 'contain' : 'cover'
    // Only real sites get browser chrome; procedural/artwork images show raw.
    if (!host) {
      return <img className="project-image" src={imageSrc} alt={`${project.title} preview`} loading="lazy" style={{ objectFit: fit, objectPosition: mode === 'modal' ? 'center' : 'center 38%' }} />
    }
    return (
      <div className="browser-frame">
        <div className="browser-bar" aria-hidden="true">
          <span className="browser-dots">
            <span className="browser-dot browser-dot-close" />
            <span className="browser-dot browser-dot-min" />
            <span className="browser-dot browser-dot-max" />
          </span>
          <span className="browser-url">
            {host ? (
              <>
                <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
                  <rect x="2.5" y="6" width="11" height="7" rx="1.2" />
                  <path d="M5.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
                </svg>
                {host}
              </>
            ) : (
              'preview'
            )}
          </span>
          <span className="browser-dots" aria-hidden="true" />
        </div>
        <img className="project-image" src={imageSrc} alt={`${project.title} preview`} loading="lazy" style={{ objectFit: fit, objectPosition: mode === 'modal' ? 'center' : 'center 18%' }} />
      </div>
    )
  }

  return (
    <>
      <div className="project-placeholder-bg" />
      <div className="project-placeholder-orbit" />
      <div className="project-placeholder-orbit orbit-b" />
      <div className="project-placeholder-core" />
    </>
  )
}

function ProjectModal({ project, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!project) return undefined
    const prev = document.activeElement
    // Defer focus: the key sequence that opened the modal is still in flight
    // (Enter re-activates whatever is focused at keyup), so only take focus
    // after it has completed.
    const focusTimer = window.setTimeout(() => {
      closeRef.current?.focus()
    }, 120)
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
      if (prev && prev.focus) prev.focus()
    }
  }, [project, onClose])

  if (!project) return null

  return (
    <div className="project-modal" role="presentation" onClick={onClose}>
      <div
        className="project-modal-panel card"
        role="dialog"
        aria-modal="true"
        aria-label={`${project.title} details`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="project-modal-close" onClick={onClose} aria-label="Close project details">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8" />
            <path d="M12 4l-8 8" />
          </svg>
        </button>
        <div className="project-modal-media project-placeholder">
          {project.demo === 'galaxy' ? (
            <Suspense fallback={<div className="milkyway-fallback" role="status" aria-label="Loading galaxy" />}>
              <MilkyWay />
            </Suspense>
          ) : (
            <ProjectMedia project={project} mode="modal" active />
          )}
        </div>
        <div className="project-modal-body">
          <h3>{project.title}</h3>
          <p>{project.description}</p>
          {project.outcome ? <p className="project-outcome"><strong>Outcome:</strong> {project.outcome}</p> : null}
          {project.caseStudy ? (
            <div className="case-study">
              {project.caseStudy.metric ? (
                <div className="case-study-metric">
                  <span className="case-study-value">{project.caseStudy.metric.value}</span>
                  <span className="case-study-meta">
                    <span className="case-study-label">{project.caseStudy.metric.label}</span>
                    {project.caseStudy.metric.sub ? (
                      <span className="case-study-sub">{project.caseStudy.metric.sub}</span>
                    ) : null}
                  </span>
                </div>
              ) : null}
              <dl className="case-study-body">
                {project.caseStudy.problem ? (
                  <div>
                    <dt>Problem</dt>
                    <dd>{project.caseStudy.problem}</dd>
                  </div>
                ) : null}
                {project.caseStudy.process ? (
                  <div>
                    <dt>Process</dt>
                    <dd>{project.caseStudy.process}</dd>
                  </div>
                ) : null}
                {project.caseStudy.result ? (
                  <div>
                    <dt>Result</dt>
                    <dd>{project.caseStudy.result}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
          <div className="stack">
            {(project.stack || []).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="project-links">
            {project.href && project.href !== '#' ? (
              <a className="button primary" href={project.href} target="_blank" rel="noreferrer">
                Open live project
              </a>
            ) : null}
            {project.repo && project.repo !== '#' ? (
              <a className="button" href={project.repo} target="_blank" rel="noreferrer">
                View source
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Projects({ projects = [] }) {
  const tiltAllowed = typeof window !== 'undefined'
    && window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)

  const tags = useMemo(() => {
    const set = new Set()
    projects.forEach((project) => (project.stack || []).forEach((item) => set.add(item)))
    return ['All', ...Array.from(set)]
  }, [projects])

  const visible = useMemo(() => {
    if (filter === 'All') return projects
    return projects.filter((project) => (project.stack || []).includes(filter))
  }, [projects, filter])

  const openProject = (project) => setSelected(project)
  const closeProject = () => setSelected(null)

  return (
    <section className="section" id="projects">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText
              as="h2"
              text="Projects"
              className="section-title"
            />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              Open any project for the full case study — decisions, trade-offs and the numbers behind it. Live apps open in a new tab. Video previews scrub on hover.
            </p>
          </div>
        </RevealGroup>

        {tags.length > 1 ? (
          <div className="project-filters" role="toolbar" aria-label="Filter projects by technology">
            {tags.map((tag) => {
              const active = tag === filter
              return (
                <button
                  key={tag}
                  type="button"
                  className={`filter-chip ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setFilter(tag)}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        ) : null}

        <RevealGroup key={filter} className="projects-grid" stagger={0.12}>
          {visible.length ? (
            visible.map((project) => (
              <article
                key={project.title}
                className="card project-card is-interactive"
                data-reveal-item
                onPointerDown={(e) => {
                  // Touch devices fire no hover, so flash the spotlight at the tap point.
                  const rect = e.currentTarget.getBoundingClientRect()
                  e.currentTarget.style.setProperty('--px', `${e.clientX - rect.left}px`)
                  e.currentTarget.style.setProperty('--py', `${e.clientY - rect.top}px`)
                }}
                onPointerMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  e.currentTarget.style.setProperty('--px', `${e.clientX - rect.left}px`)
                  e.currentTarget.style.setProperty('--py', `${e.clientY - rect.top}px`)
                  if (!tiltAllowed) return
                  const nx = (e.clientX - rect.left) / rect.width - 0.5
                  const ny = (e.clientY - rect.top) / rect.height - 0.5
                  e.currentTarget.style.setProperty('--rx', `${(-ny * 6).toFixed(2)}deg`)
                  e.currentTarget.style.setProperty('--ry', `${(nx * 7).toFixed(2)}deg`)
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.setProperty('--rx', '0deg')
                  e.currentTarget.style.setProperty('--ry', '0deg')
                }}
                onClick={(e) => {
                  // Only non-interactive areas (media, padding) open the case study;
                  // buttons/links handle themselves.
                  if (e.target.closest('a, button')) return
                  openProject(project)
                }}
              >
                <div className="project-placeholder">
                  <ProjectMedia project={project} mode="card" />
                </div>
                <div className="project-body">
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <div className="stack">
                    {(project.stack || []).map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                  <div className="project-actions">
                    <button
                      type="button"
                      className="button primary project-case-btn"
                      aria-label={`View case study for ${project.title}`}
                      onClick={() => openProject(project)}
                    >
                      View case study
                      <svg
                        className="btn-arrow"
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" />
                      </svg>
                    </button>
                    <div className="project-links">
                      {project.href && project.href !== '#' ? (
                        <a href={project.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          Live
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M4 12 12 4M6.5 4H12v5.5" />
                          </svg>
                        </a>
                      ) : (
                        <span className="project-link-muted" aria-hidden="true">
                          Live soon
                        </span>
                      )}
                      {project.repo && project.repo !== '#' ? (
                        <a href={project.repo} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          Source
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M4 12 12 4M6.5 4H12v5.5" />
                          </svg>
                        </a>
                      ) : (
                        <span className="project-link-muted" aria-hidden="true">
                          Source private
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="projects-empty" role="status">
              No projects match <strong>{filter}</strong>.
            </p>
          )}
        </RevealGroup>
      </div>

      <ProjectModal project={selected} onClose={closeProject} />
    </section>
  )
}
