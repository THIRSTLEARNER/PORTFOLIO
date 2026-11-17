import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import About from './components/About.jsx'
import Experience from './components/Experience.jsx'
import Skills from './components/Skills.jsx'
import Certifications from './components/Certifications.jsx'
import Projects from './components/Projects.jsx'
import Github from './components/Github.jsx'
import PullQuote from './components/PullQuote.jsx'
import GalaxyRunner from './components/GalaxyRunner.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import CometField from './components/CometField.jsx'
import ScrollProgress from './components/ScrollProgress.jsx'
import AnyaPet from './components/AnyaPet.jsx'
import SmoothScroll from './components/SmoothScroll.jsx'
import { portfolioData } from './data/portfolioData.js'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SmoothScroll />
      <CometField />
      <CommandPalette data={portfolioData} />
      <ScrollProgress />
      <Navbar name={portfolioData.name} />
      <main id="main" tabIndex={-1}>
        <Hero data={portfolioData} />
        <GalaxyRunner />
        <About paragraphs={portfolioData.about} highlights={portfolioData.highlights} />
        <Experience items={portfolioData.experience} />
        <Skills skills={portfolioData.skills} />
        <Certifications certifications={portfolioData.certifications} />
        <Projects projects={portfolioData.projects} />
        <Github user={portfolioData.githubUser} />
        <PullQuote text={portfolioData.pullQuote?.text} attribution={portfolioData.pullQuote?.attribution} />
        <Contact data={portfolioData} />
      </main>
      <Footer name={portfolioData.name} />
      <AnyaPet />
    </>
  )
}
