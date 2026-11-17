import StaggerText from './StaggerText.jsx'
import RevealGroup from './RevealGroup.jsx'

export default function PullQuote({ text, attribution }) {
  if (!text) return null

  return (
    <figure className="pull-quote" id="approach" aria-label="Philosophy">
      <svg
        className="pull-quote-orbit"
        viewBox="0 0 320 220"
        aria-hidden="true"
        focusable="false"
      >
        <g className="pull-quote-orbit-tilt">
          <ellipse cx="160" cy="110" rx="148" ry="54" />
          <ellipse cx="160" cy="110" rx="98" ry="34" />
          <circle className="orbit-star-halo" cx="42" cy="78" r="7" />
          <circle className="orbit-star" cx="42" cy="78" r="2.6" />
          <circle className="orbit-dot" cx="241" cy="130" r="2" />
        </g>
      </svg>
      <RevealGroup className="container pull-quote-inner" stagger={0.16} y={34}>
        <svg
          className="pull-quote-mark"
          viewBox="0 0 96 72"
          aria-hidden="true"
          focusable="false"
          data-reveal-item
        >
          <text x="0" y="66">“</text>
        </svg>
        <blockquote className="pull-quote-quote">
          <StaggerText
            as="p"
            mode="chars"
            stagger={0.018}
            duration={0.85}
            text={text}
            className="pull-quote-text"
          />
        </blockquote>
        {attribution ? (
          <figcaption className="pull-quote-by" data-reveal-item>
            <span className="pull-quote-by-rule" aria-hidden="true" />
            <span className="pull-quote-by-name">{attribution.replace(/^[—–-]\s*/, '')}</span>
          </figcaption>
        ) : null}
      </RevealGroup>
    </figure>
  )
}
