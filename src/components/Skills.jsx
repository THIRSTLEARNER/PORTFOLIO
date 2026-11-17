import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

gsap.registerPlugin(ScrollTrigger)

export default function Skills({ skills }) {
  const listRef = useRef(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const chips = list.querySelectorAll('.skill-chip')
    if (reduce || chips.length === 0) return undefined

    gsap.set(chips, { y: 22, opacity: 0, scale: 0.96, filter: 'blur(4px)' })

    const tween = gsap.to(chips, {
      y: 0,
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      duration: 0.55,
      ease: 'power3.out',
      stagger: { each: 0.045, from: 'start' },
      clearProps: 'transform,filter,opacity',
      scrollTrigger: {
        trigger: list,
        start: 'top 88%',
        once: true,
      },
    })

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(chips, { clearProps: 'all' })
    }
  }, [skills])

  return (
    <section className="section" id="skills">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText as="h2" text="Tools I work with" className="section-title" />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              Technologies I use regularly.
            </p>
          </div>
          <div>
            <ul ref={listRef} className="skills-list" aria-label="Tech stack">
              {skills.map((skill) => (
                <li
                  key={skill}
                  className="skill-chip"

                >
                  <span className="skill-chip-label">{skill}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealGroup>
      </div>
    </section>
  )
}
