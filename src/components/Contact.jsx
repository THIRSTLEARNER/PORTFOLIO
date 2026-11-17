import { useState } from 'react'
import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

export default function Contact({ data }) {
  const [status, setStatus] = useState({ state: 'idle', message: '', nonce: 0 })
  const [shaking, setShaking] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      // Honeypot — invisible to humans, tempting to bots
      company: String(formData.get('company') || '').trim(),
    }

    setStatus({ state: 'sending', message: '' })
    try {
      // Dev: Vite proxies /api to the mail server (PORT in .env).
      // Production (Vercel): /api/contact is a same-origin serverless function.
      // VITE_API_URL overrides both if you ever split the API onto another host.
      const endpoint = import.meta.env.VITE_API_URL || '/api/contact'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Could not send your message.')
      }
      form.reset()
      setStatus({ state: 'success', message: 'Message sent. I’ll get back to you soon.', nonce: Date.now() })
      // Let the pet celebrate the win
      window.dispatchEvent(new CustomEvent('anya:celebrate'))
    } catch (err) {
      setStatus({
        state: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'Could not send right now. Please try again in a minute or email me directly.',
        nonce: Date.now(),
      })
      setShaking(true)
    }
  }

  const sending = status.state === 'sending'

  return (
    <section className="section" id="contact">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText as="h2" text="Get in touch" className="section-title" />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              {data.availability ? `${data.availability}.` : ''} Send a message here and I’ll reply by email.
            </p>
          </div>
          <div data-reveal-item className="contact-grid">
            <div className="card contact-card">
              <h3>Send a message</h3>
              <form
                className={`contact-form${shaking ? ' is-shaking' : ''}`}
                onSubmit={handleSubmit}
                noValidate={false}
                onAnimationEnd={(e) => {
                  if (e.animationName === 'contact-shake') setShaking(false)
                }}
              >
                <label>
                  Name
                  <input name="name" type="text" autoComplete="name" required disabled={sending} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" required disabled={sending} />
                </label>
                <label>
                  Message
                  <textarea name="message" rows="4" required disabled={sending} />
                </label>
                <label className="hp-field" aria-hidden="true">
                  Company
                  <input name="company" type="text" tabIndex={-1} autoComplete="off" disabled={sending} />
                </label>
                <button className="button primary" type="submit" disabled={sending}>
                  {sending ? 'Sending…' : 'Send Message'}
                </button>
                <p
                  className={`contact-status${status.state !== 'idle' ? ` is-${status.state}` : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {status.state === 'success' ? (
                    <svg
                      key={status.nonce}
                      className="contact-check"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle className="contact-check-circle" cx="12" cy="12" r="9.4" />
                      <path className="contact-check-mark" d="M7.6 12.6l3 3L16.4 8.9" />
                    </svg>
                  ) : null}
                  {status.message}
                </p>
              </form>
            </div>
            <div className="card contact-card">
              <h3>Find me online</h3>
              <p>
                Email: <a href={`mailto:${data.email}`}>{data.email}</a>
              </p>
              {data.resumeUrl ? (
                <p>
                  <a
                    className="button contact-resume"
                    href={data.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={data.resumeUrl.startsWith('/') ? 'Resume.pdf' : undefined}

                  >
                    Download résumé
                  </a>
                </p>
              ) : null}
              {data.bookingUrl ? (
                <p>
                  <a
                    className="button call-button"
                    href={data.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"

                  >
                    Book a 15-min call
                  </a>
                </p>
              ) : null}
              <div className="social-links">
                {(data.socials || []).map((social) => (
                  <a key={social.label} className="button" href={social.href} target="_blank" rel="noreferrer">
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </RevealGroup>
      </div>
    </section>
  )
}
