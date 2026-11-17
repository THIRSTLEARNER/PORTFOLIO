import { useEffect, useRef, useState } from 'react'
import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

export default function Certifications({ certifications = [] }) {
  const [selected, setSelected] = useState(null)
  const closeRef = useRef(null)
  const tiltAllowed = typeof window !== 'undefined'
    && window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const onPointerDown = (e) => {
    // Flash the spotlight at the tap point on touch devices.
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
    e.currentTarget.style.setProperty('--rx', `${(-ny * 6).toFixed(2)}deg`)
    e.currentTarget.style.setProperty('--ry', `${(nx * 7).toFixed(2)}deg`)
  }
  const onPointerLeave = (e) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }

  // Focus discipline identical to the project modal: grab focus on open,
  // Escape closes, focus restores to the card the user came from.
  useEffect(() => {
    if (!selected) return undefined
    const prev = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
      if (prev && prev.focus) prev.focus()
    }
  }, [selected])

  const open = (cert) => () => setSelected(cert)
  const openKey = (cert) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected(cert)
    }
  }

  return (
    <section className="section" id="certifications">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText as="h2" text="Certifications" className="section-title" />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              Certifications and completed courses. Select one to view the certificate.
            </p>
          </div>
        </RevealGroup>

        <RevealGroup className="cert-grid" stagger={0.14}>
          {certifications.map((cert, index) => (
            <article
              key={`${cert.title}-${index}`}
              className="card cert-card is-interactive"
              data-reveal-item
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={`View certificate: ${cert.title}`}
              onClick={open(cert)}
              onKeyDown={openKey(cert)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
            >
              <div className="cert-media">
                {cert.image ? (
                  <img className="cert-image" src={cert.image} alt={cert.imageAlt || `${cert.title} certificate`} loading="lazy" />
                ) : (
                  <div className="cert-placeholder" aria-hidden="true">
                    <div className="cert-placeholder-seal" />
                    <span className="cert-placeholder-label">Certificate preview</span>
                  </div>
                )}
                <span className="cert-media-hint" aria-hidden="true">View</span>
              </div>
              <div className="cert-head">
                <span className="cert-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="cert-date">{cert.date}</span>
              </div>
              <h3 className="cert-title">{cert.title}</h3>
              <p className="cert-issuer">{cert.issuer}</p>
              {cert.credentialId ? <p className="cert-id">{cert.credentialId}</p> : null}
              <span className="cert-link-hint" aria-hidden="true">
                View certificate
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12 12 4M6.5 4H12v5.5" />
                </svg>
              </span>
            </article>
          ))}
        </RevealGroup>
      </div>

      {selected ? (
        <div className="cert-modal" role="presentation" onClick={() => setSelected(null)}>
          <div
            className="cert-modal-panel card"
            role="dialog"
            aria-modal="true"
            aria-label={`Certificate: ${selected.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              className="project-modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close certificate viewer"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M4 4l8 8" />
                <path d="M12 4l-8 8" />
              </svg>
            </button>

            <div className="cert-modal-media">
              {selected.image ? (
                <img src={selected.image} alt={selected.imageAlt || `${selected.title} certificate`} />
              ) : (
                <div className="cert-modal-seal" aria-hidden="true">
                  <svg viewBox="0 0 120 120" width="120" height="120" fill="none">
                    <circle cx="60" cy="60" r="52" stroke="var(--accent)" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="3 5" />
                    <circle cx="60" cy="60" r="38" stroke="var(--accent)" strokeWidth="1.6" />
                    <circle cx="60" cy="60" r="26" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="1" />
                    <path d="M60 46l4.3 10.6 11.7 1.1-8.8 7.4 2.5 11.4L60 73.4 49.9 76.5l2.6-11.4-8.8-7.4 11.7-1.1L60 46z" fill="var(--accent)" fillOpacity="0.9" />
                  </svg>
                  <p className="cert-modal-seal-caption">Certificate</p>
                </div>
              )}
            </div>

            <div className="cert-modal-body">
              <span className="cert-modal-date">{selected.date}</span>
              <h3>{selected.title}</h3>
              <p className="cert-modal-issuer">{selected.issuer}</p>
              {selected.credentialId ? (
                <p className="cert-modal-id">
                  <span className="cert-modal-id-label">Credential ID</span>
                  <span className="cert-modal-id-value">{selected.credentialId}</span>
                </p>
              ) : null}
              <div className="cert-modal-actions">
                {selected.href && selected.href !== '#' ? (
                  <a className="button primary" href={selected.href} target="_blank" rel="noreferrer">
                    Verify credential
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 12 12 4M6.5 4H12v5.5" />
                    </svg>
                  </a>
                ) : (
                  <span className="cert-modal-muted">Verification link not added yet.</span>
                )}
                <button type="button" className="button" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
