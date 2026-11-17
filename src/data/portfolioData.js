export const portfolioData = {
  name: 'Villanueva Rainier M',
  role: 'Full-Stack Developer',
  tagline:
    'Full-stack web development with React and Node.js.',
  location: 'Calatagan, Batangas, Philippines',
  email: 'zanedias15@gmail.com',
  resumeUrl: '/resume.pdf',
  availability: 'Open to freelance and full-time work',
  githubUser: 'THIRSTLEARNER',
  // Secondary CTA in the contact section, e.g. your booking link:
  // bookingUrl: 'https://calendly.com/your-handle',
  bookingUrl: '',
  socials: [
    { label: 'GitHub', href: 'https://github.com/THIRSTLEARNER' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/yourname' },
    { label: 'X / Twitter', href: 'https://x.com/yourname' },
  ],
  profileImages: ['/images/me-avatar.jpg'],
  about: [
    'I’m a full-stack developer and UI designer with a passion for building web applications that are both functional and visually appealing. I enjoy working on projects that challenge me to learn new technologies and improve my skills. I’m currently studying at Batangas State University ARASOF.',
  ],
  highlights: [
    { label: 'Focus', value: 'React, Node.js, web application development' },
    { label: 'Strengths', value: 'Frontend implementation, maintainable code' },
    { label: 'Based in', value: 'Calatagan, Batangas, Philippines' },
  ],
  experience: [
    {
      period: '2024 — Present',
      title: 'Full-Stack Developer',
      org: 'Independent / Project Work',
      summary:
        'Designing and building web applications end to end — responsive frontends, and deployment-ready workflows.',
      tags: ['React', 'Node.js'],
    },
    {
      period: '2023 — 2024',
      title: 'Web Developer',
      org: 'Selected Collaborations',
      summary:
        'Delivered features and UI improvements with an emphasis on performance, maintainability, and clear communication.',
      tags: ['JavaScript', 'laravel', 'React', 'Node.js'],
    },
  ],
  skills: [
    'React',
    'Node.js',
    'JavaScript',
    'TypeScript',
    'Express',
    'Vite',
    'HTML & CSS',
    'Git',
    'UI Design',
  ],
  certifications: [
    {
      title: 'Certification Name',
      issuer: 'Issuing Organization',
      date: '2026',
      credentialId: 'ID / Credential URL (optional)',
      href: '#',
      image: '',
    },
    {
      title: 'Another Certification',
      issuer: 'Issuing Organization',
      date: '2025',
      credentialId: '',
      href: '#',
      image: '',
    },
  ],
  projects: [
    {
      title: 'Sign Detector',
      description:
        'A web app that detects signs and creates a galaxy from them.',
      stack: [ "React", 'Node.js'],
      // Media slots — drop a screen recording in public/videos/ and wire it here,
      // e.g. video: '/videos/sign-detector.mp4' (optionally with poster: '/videos/sign-detector.jpg').
      video: '',
      poster: '',
      image: '/images/sign-detector.jpg',
      href: 'https://sign-detector-qy4c1vg8w-rainier3.vercel.app/',
      repo: 'https://github.com/THIRSTLEARNER/sign-detector',
      caseStudy: {
        problem:
          'Turn a webcam feed into a generative galaxy driven by hand signs — running entirely in the browser, with no ML backend to pay for or maintain.',
        process:
          'Capture webcam frames in a requestAnimationFrame loop, run TensorFlow.js (COCO-SSD) and MediaPipe Hands landmarks on every frame, map the detections onto particle emitters on a canvas, and animate a seeded galaxy that responds to the tracked signs. Shipped as a static Vercel deployment.',
        result:
          'A fully in-browser interactive demo — gesture-driven generative visuals with zero server cost and no backend latency.',
        metric: {
          value: '100',
          label: 'Lighthouse Best Practices',
          sub: 'Live-site audit, Nov 2026',
        },
      },
    },
    {
      title: 'Snap Booth',
      description:
        'A web app that allows users to take photos and apply fun filters.',
      stack: ['Node.js', 'React', 'CSS'],
      video: '',
      poster: '',
      image: '/images/snapbooth.jpg',
      href: 'https://rainierphotobooth.vercel.app/',
      repo: 'https://github.com/THIRSTLEARNER/photobooth',
      caseStudy: {
        problem:
          'Build a photobooth that lives entirely in the browser — filters, frames, face-tracked props and downloadable photo strips, with no app install and no server.',
        process:
          'Browser camera APIs with real-time face tracking driving contextual props, a layered filter/frame engine composed onto a shareable strip, tuned for mobile viewports (theme-color, viewport-fit). Built with React + Vite and deployed as a static site.',
        result:
          'A zero-install photobooth anyone can open, face-tracked props included, that ships perfectly on accessibility, best practices and SEO audits.',
        metric: {
          value: '3 × 100',
          label: 'Lighthouse a11y · Best Practices · SEO',
          sub: 'Live-site audit, Nov 2026',
        },
      },
    },
    {
      title: 'Freelance Website',
      description:
        'A freelance website about computers and laptop that you can order.',
      stack: ['HTML', 'CSS', 'JavaScript'],
      video: '',
      poster: '',
      image: '/images/freelancewebsite.jpg',
      href: 'https://freelancewebsite-flax.vercel.app/',
      repo: 'https://github.com/THIRSTLEARNER/freelancewebsite',
      caseStudy: {
        problem:
          'A laptop and computer store needed a zero-cost storefront — full product catalog, cart, categories and trust signals — with no budget for a backend or CMS.',
        process:
          'Hand-built static multi-page HTML/CSS/vanilla-JS (Home, Product, Cart, Account, About, Contact): responsive grid layout, CSS product cards with ratings, vanilla-JS slide-down mobile menu, category and “Top Selling / Latest” sections, a brand trust row, and customer testimonial blocks. Deployed as static files on Vercel.',
        result:
          'A complete shop experience — catalog, ratings, cart and social proof — running for free as a static site.',
        metric: {
          value: '100',
          label: 'Lighthouse Best Practices',
          sub: 'Live-site audit, Nov 2026',
        },
      },
    },
    {
      title: 'Procedural Galaxy',
      description:
        'A WebGL galaxy generated purely in code — 18,000 particles, no textures, drag to orbit.',
      stack: ['Three.js', 'JavaScript'],
      video: '',
      poster: '',
      image: '/images/procedural-galaxy.jpg',
      href: '#',
      repo: '#',
      demo: 'galaxy',
      caseStudy: {
        problem:
          'Render a spiral galaxy with silky motion on ordinary hardware — no meshes, no textures, no downloads.',
        process:
          'BufferGeometry + PointsMaterial with per-particle size, phase, speed and opacity; a drag-to-orbit pointer model with inertial easing; IntersectionObserver + visibilitychange pause; prefers-reduced-motion path renders half the particles statically.',
        result:
          'An entire galaxy on screen at once — in two draw calls, with zero image assets shipped.',
        metric: {
          value: '2',
          label: 'Draw calls for 18k particles',
          sub: 'Points × 2 · zero textures',
        },
      },
    },
  ],
  // Full-bleed pull-quote strip between projects/GitHub and testimonials.
  // Written to match how the live apps actually audit (see case studies).
  // Swap in a real client quote when one exists:
  // text: 'Quote from a client.', attribution: '— Name, Role'
  pullQuote: {
    text: 'Fast, accessible, considered — that’s how I build for the web.',
    attribution: '— Rainier M.',
  },
  testimonials: [
    {
      quote:
        'Rainier brought clarity to a messy problem and shipped a solution that was easy for the team to maintain.',
      name: 'Austin V',
      role: 'co Developer',
    },
    {
      quote:
        'Thoughtful about both the user experience and the technical details — communication was clear throughout.',
      name: 'Bamstay Dormies Team',
      role: 'Ui/UX Designer',
    },
  ],
}
