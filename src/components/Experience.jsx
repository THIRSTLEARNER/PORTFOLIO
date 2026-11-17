import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

gsap.registerPlugin(ScrollTrigger)

export default function Experience({ items = [] }) {
  const timelineRef = useRef(null)

  // Draw the Journey rail line and pop the markers as it passes — paired
  // with the section's existing scroll reveals. Reduced motion keeps the
  // static border and visible markers (today's look).
  useLayoutEffect(() => {
    const el = timelineRef.current
    if (!el) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const line = el.querySelector('.timeline-line-path')
    const markers = el.querySelectorAll('.timeline-marker')
    if (reduce || !line) return undefined

    gsap.set(line, { strokeDashoffset: 100 })
    gsap.set(markers, { scale: 0.15, opacity: 0 })

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: 'top 78%',
        end: 'bottom 62%',
        scrub: 0.55,
      },
    })
    tl.to(line, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0)
    tl.to(markers, { scale: 1, opacity: 1, duration: 0.22, stagger: 0.35, ease: 'back.out(2.2)' }, 0.05)

    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
      gsap.set(line, { clearProps: 'strokeDashoffset' })
      gsap.set(markers, { clearProps: 'transform,opacity' })
    }
  }, [])

  if (!items.length) return null

  return (
    <section className="section" id="experience">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText as="h2" text="Experience" className="section-title" />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              Recent roles and project work.
            </p>
          </div>
        </RevealGroup>

        <div className="timeline-rail" ref={timelineRef}>
          <svg className="timeline-line" viewBox="0 0 2 100" preserveAspectRatio="none" aria-hidden="true">
            <line className="timeline-line-path" x1="1" y1="0" x2="1" y2="100" pathLength="100" strokeWidth="2" />
          </svg>
          <RevealGroup className="timeline" as="ol" stagger={0.12}>
            {items.map((item) => (
              <li key={`${item.period}-${item.title}`} className="timeline-item" data-reveal-item>
                <div className="timeline-marker" aria-hidden="true" />
                <article className="card timeline-card">
                  <div className="timeline-meta">
                    <span className="timeline-period">{item.period}</span>
                    {item.org ? <span className="timeline-org">{item.org}</span> : null}
                  </div>
                  <h3 className="timeline-title">{item.title}</h3>
                  {item.summary ? <p className="timeline-summary">{item.summary}</p> : null}
                  {item.tags?.length ? (
                    <div className="stack timeline-tags" aria-label="Technologies">
                      {item.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              </li>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  )
}
