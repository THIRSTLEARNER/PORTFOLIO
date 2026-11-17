import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

export default function About({ paragraphs = [], highlights = [] }) {
  return (
    <section className="section" id="about">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText as="h2" text="About" className="section-title" />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              What I do, how I work, and what I’m focused on.
            </p>
          </div>
          <div data-reveal-item>
            <div className="card about-card">
              {paragraphs.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {highlights.length ? (
                <dl className="about-highlights" aria-label="Highlights">
                  {highlights.map((item) => (
                    <div key={item.label} className="about-highlight">
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>
        </RevealGroup>
      </div>
    </section>
  )
}
