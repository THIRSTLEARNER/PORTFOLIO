import Marquee from './Marquee.jsx'
import RevealGroup from './RevealGroup.jsx'

export default function Footer({ name }) {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <RevealGroup className="container footer-top" stagger={0.14}>
        <small data-reveal-item>
          © {year} {name}
        </small>
      </RevealGroup>
      <Marquee items={[`${name}`, 'Portfolio']} className="footer-marquee" />
    </footer>
  )
}
