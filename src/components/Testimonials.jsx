import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

export default function Testimonials({ items = [] }) {
  if (!items.length) return null

  return (
    <section className="section" id="testimonials">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText as="h2" text="Feedback" className="section-title" />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              Notes from people I’ve worked with.
            </p>
          </div>
        </RevealGroup>

        <RevealGroup className="testimonials-grid" stagger={0.14}>
          {items.map((item) => (
            <figure key={`${item.name}-${item.quote.slice(0, 24)}`} className="card testimonial-card" data-reveal-item>
              <blockquote className="testimonial-quote">
                <p>{item.quote}</p>
              </blockquote>
              <figcaption className="testimonial-meta">
                <span className="testimonial-name">{item.name}</span>
                {item.role ? <span className="testimonial-role">{item.role}</span> : null}
              </figcaption>
            </figure>
          ))}
        </RevealGroup>
      </div>
    </section>
  )
}
