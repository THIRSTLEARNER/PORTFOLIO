import { useEffect, useRef, useState } from 'react'

const rand = (min, max) => min + Math.random() * (max - min)
const GY = 46 // px of ground clearance below the stage
const pad = (n) => String(Math.max(0, Math.floor(n))).padStart(5, '0')

const HI_KEY = 'galaxy-runner-hi'
// static constellation pose for the cover art (bob = 0, stride neutral)
const COVER_DINO_POINTS = {
  tailTip: { x: -34, y: -6 }, tailMid: { x: -19, y: -10 }, pelvis: { x: 0, y: -16 },
  chest: { x: 14, y: -20 }, shoulder: { x: 22, y: -23 }, neck: { x: 27, y: -30 },
  headBack: { x: 31, y: -33 }, snout: { x: 42, y: -33 }, jaw: { x: 43, y: -25 }, chin: { x: 27, y: -23 },
  backKnee: { x: -6, y: -6 }, backFoot: { x: -9, y: 0 },
  frontKnee: { x: 7, y: -7 }, frontFoot: { x: 11, y: 0 },
  elbow: { x: 29, y: -15 }, hand: { x: 33, y: -10 },
}
const COVER_DINO_BONES = [
  ['tailTip', 'tailMid'], ['tailMid', 'pelvis'],
  ['pelvis', 'chest'], ['chest', 'neck'], ['neck', 'headBack'],
  ['headBack', 'snout'], ['snout', 'jaw'], ['jaw', 'chin'], ['chin', 'shoulder'], ['chin', 'chest'],
  ['pelvis', 'backKnee'], ['backKnee', 'backFoot'],
  ['pelvis', 'frontKnee'], ['frontKnee', 'frontFoot'],
  ['shoulder', 'elbow'], ['elbow', 'hand'],
]

export default function GalaxyRunner() {
  const canvasRef = useRef(null)
  const startRef = useRef(null)
  const leaveTimer = useRef(null)
  const stageRef = useRef(null)
  const dinoRef = useRef(null)
  const [covered, setCovered] = useState(true)
  const [revealing, setRevealing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [coverHi] = useState(() => {
    try {
      return Number(localStorage.getItem(HI_KEY) || '0') || 0
    } catch {
      return 0
    }
  })

  // exit: the WHOLE cover disintegrates — every star, glyph, bone, glow edge,
  // frame tick and the ember dot are rendered to an offscreen canvas at tap time,
  // then their actual pixels are harvested and dropped as chunky tiles. Nothing
  // fades "as a panel": the face itself is what falls.
  const crumbleDino = () => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const stage = stageRef.current
      const dino = dinoRef.current
      if (!stage) return
      const cover = stage.querySelector('.runner-cover')
      if (!cover) return
      const sRect = stage.getBoundingClientRect()
      const W = Math.max(1, Math.floor(sRect.width))
      const H = Math.max(1, Math.floor(sRect.height))
      const take = (list, n) => {
        if (list.length <= n) return list
        const out = []
        const used = new Set()
        while (out.length < n) {
          const i = (Math.random() * list.length) | 0
          if (!used.has(i)) { used.add(i); out.push(list[i]) }
        }
        return out
      }

      // ---- render the cover exactly as it looks to an offscreen canvas ----
      const snap = document.createElement('canvas')
      snap.width = W
      snap.height = H
      const c = snap.getContext('2d', { willReadFrequently: true })
      // base vertical lerp: #06070c → #0a0a12 → #070709
      const bg = c.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#06070c')
      bg.addColorStop(0.58, '#0a0a12')
      bg.addColorStop(1, '#070709')
      c.fillStyle = bg
      c.fillRect(0, 0, W, H)
      // ember nebula, upper right
      let g = c.createRadialGradient(W * 0.82, -H * 0.12, 0, W * 0.82, -H * 0.12, H * 1.15)
      g.addColorStop(0, 'rgba(239, 162, 71, 0.16)')
      g.addColorStop(1, 'rgba(239, 162, 71, 0)')
      c.fillStyle = g
      c.fillRect(0, 0, W, H)
      // ion horizon band, lower
      g = c.createRadialGradient(W * 0.5, H * 1.18, 0, W * 0.5, H * 1.18, H * 1.35)
      g.addColorStop(0, 'rgba(94, 234, 212, 0.17)')
      g.addColorStop(1, 'rgba(94, 234, 212, 0)')
      c.fillStyle = g
      c.fillRect(0, 0, W, H)
      // faint stars scattered over the sky
      for (let i = 0; i < 52; i++) {
        c.globalAlpha = 0.22 + Math.random() * 0.62
        c.fillStyle = '#e9fdff'
        c.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H * 0.62), 1, 1)
      }
      c.globalAlpha = 1
      // inset cabinet frame
      const fin = 12
      c.strokeStyle = 'rgba(190, 249, 255, 0.13)'
      c.lineWidth = 1
      c.strokeRect(fin + 0.5, fin + 0.5, W - fin * 2 - 1, H - fin * 2 - 1)
      // teal L corner ticks — top-left, bottom-right
      c.strokeStyle = '#5eead4'
      c.lineWidth = 2
      c.shadowColor = 'rgba(94, 234, 212, 0.7)'
      c.shadowBlur = 4
      const L = 15
      c.beginPath()
      c.moveTo(fin, fin + L)
      c.lineTo(fin, fin)
      c.lineTo(fin + L, fin)
      c.moveTo(W - fin, H - fin - L)
      c.lineTo(W - fin, H - fin)
      c.lineTo(W - fin - L, H - fin)
      c.stroke()
      c.shadowBlur = 0
      // horizon rule — the game's own glow line, where the strip sits
      const stripEl = cover.querySelector('.runner-cover-strip')
      if (stripEl) {
        const sr = stripEl.getBoundingClientRect()
        const ly = sr.top - sRect.top + 0.75
        const lg = c.createLinearGradient(0, 0, W, 0)
        lg.addColorStop(0, 'rgba(94, 234, 212, 0)')
        lg.addColorStop(0.12, 'rgba(94, 234, 212, 0.75)')
        lg.addColorStop(0.5, '#d9f9fb')
        lg.addColorStop(0.88, 'rgba(94, 234, 212, 0.75)')
        lg.addColorStop(1, 'rgba(94, 234, 212, 0)')
        c.strokeStyle = lg
        c.lineWidth = 1.5
        c.shadowColor = 'rgba(94, 234, 212, 0.6)'
        c.shadowBlur = 6
        c.beginPath()
        c.moveTo(0, ly)
        c.lineTo(W, ly)
        c.stroke()
        c.shadowBlur = 0
      }
      // text elements drawn at their real rects, real fonts
      const drawT = (sel, mode, color, strokeW) => {
        const el = cover.querySelector(sel)
        if (!el) return
        const r = el.getBoundingClientRect()
        if (!r.width) return
        const cs = window.getComputedStyle(el)
        c.save()
        c.translate(r.left - sRect.left, r.top - sRect.top)
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        try { c.letterSpacing = cs.letterSpacing } catch { /* older engines */ }
        c.textBaseline = 'middle'
        const txt = cs.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent
        if (mode === 'stroke') {
          c.strokeStyle = color
          c.lineWidth = strokeW || 1.25
          c.lineJoin = 'round'
          c.strokeText(txt, 0, r.height / 2)
        } else {
          c.fillStyle = color
          c.fillText(txt, 0, r.height / 2)
        }
        c.restore()
      }
      drawT('.is-filled', 'fill', '#e9fdff')
      drawT('.is-open', 'stroke', '#d9f9fb', 1.25)
      drawT('.runner-cover-hi', 'fill', '#e9fdff')
      drawT('.runner-cover-cta', 'fill', '#e9fdff')
      // the ember dot riding at the end of the CTA
      const dot = cover.querySelector('.runner-cover-dot')
      if (dot) {
        const r = dot.getBoundingClientRect()
        c.fillStyle = '#efa247'
        c.shadowColor = 'rgba(239, 162, 71, 0.85)'
        c.shadowBlur = 6
        c.beginPath()
        c.arc(r.left - sRect.left + r.width / 2, r.top - sRect.top + r.height / 2, Math.max(2.5, r.width / 2), 0, Math.PI * 2)
        c.fill()
        c.shadowBlur = 0
      }
      // the constellation — bones, joints, ember eye
      if (dino) {
        const vb = dino.viewBox.baseVal
        const r = dino.getBoundingClientRect()
        const kx = r.width / vb.width
        const ky = r.height / vb.height
        const toStage = (x, y) => ({ x: r.left - sRect.left + (x - vb.x) * kx, y: r.top - sRect.top + (y - vb.y) * ky })
        c.strokeStyle = 'rgba(190, 249, 255, 0.8)'
        c.lineWidth = 1.15
        c.lineCap = 'round'
        dino.querySelectorAll('.runner-cover-dino-bones line').forEach((line) => {
          const a = toStage(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')))
          const b = toStage(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')))
          c.beginPath()
          c.moveTo(a.x, a.y)
          c.lineTo(b.x, b.y)
          c.stroke()
        })
        c.fillStyle = '#e9fdff'
        dino.querySelectorAll('.runner-cover-dino-dots circle').forEach((dotEl) => {
          const p = toStage(Number(dotEl.getAttribute('cx')), Number(dotEl.getAttribute('cy')))
          c.beginPath()
          c.arc(p.x, p.y, Number(dotEl.getAttribute('r')), 0, Math.PI * 2)
          c.fill()
        })
        const eye = dino.querySelector('.runner-cover-dino-eye')
        if (eye) {
          const p = toStage(Number(eye.getAttribute('cx')), Number(eye.getAttribute('cy')))
          c.fillStyle = '#efa247'
          c.shadowColor = 'rgba(239, 162, 71, 0.9)'
          c.shadowBlur = 4
          c.beginPath()
          c.arc(p.x, p.y, Number(eye.getAttribute('r')) || 1.15, 0, Math.PI * 2)
          c.fill()
          c.shadowBlur = 0
        }
      }

      // ---- harvest the face, pixel by pixel ----
      const img = c.getImageData(0, 0, W, H).data
      const bgAt = (x, y) => {
        // base vertical lerp, exactly the gradient above
        const t = y / H
        let r
        let g
        let b
        if (t < 0.58) {
          const k = t / 0.58
          r = 6 + (10 - 6) * k; g = 7 + (10 - 7) * k; b = 12 + (18 - 12) * k
        } else {
          const k = (t - 0.58) / 0.42
          r = 10 + (7 - 10) * k; g = 10 + (7 - 10) * k; b = 18 + (9 - 18) * k
        }
        // ember nebula upper right
        const ex = (x - W * 0.82) / (W * 0.5)
        const ey = (y + H * 0.12) / (H * 0.62)
        const e = Math.max(0, 1 - (ex * ex + ey * ey)) ** 2
        r += (239 - r) * 0.34 * e; g += (162 - g) * 0.34 * e; b += (71 - b) * 0.34 * e
        // ion horizon
        const ix = (x - W * 0.5) / (W * 0.62)
        const iy = (y - H * 1.18) / (H * 0.7)
        const e2 = Math.max(0, 1 - (ix * ix + iy * iy)) ** 2
        r += (94 - r) * 0.3 * e2; g += (234 - g) * 0.3 * e2; b += (212 - b) * 0.3 * e2
        return [r, g, b]
      }
      const sources = []
      for (let y = 0; y < H; y += 5) {
        for (let x = 0; x < W; x += 5) {
          const i = (y * W + x) * 4
          if (img[i + 3] < 40) continue
          const r = img[i]
          const g2 = img[i + 1]
          const b = img[i + 2]
          const bgc = bgAt(x, y)
          const diff = Math.max(Math.abs(r - bgc[0]), Math.abs(g2 - bgc[1]), Math.abs(b - bgc[2]))
          const keepProb = diff < 24 ? 0.03 : 0.4
          if (Math.random() < keepProb) {
            let cr = r
            let cg2 = g2
            let cb = b
            if (diff < 24) {
              // moonlit-slate lift — background dust reads against the void
              const m = 0.55
              cr = Math.round(r + (94 - r) * m)
              cg2 = Math.round(g2 + (116 - g2) * m)
              cb = Math.round(b + (140 - b) * m)
            }
            sources.push({ x, y, color: `rgb(${cr},${cg2},${cb})`, delay: 150 + (x / W) * 420 + Math.random() * 120 })
          }
        }
      }
      const finalSources = take(sources, 720)
      if (!finalSources.length) return
      // the crumble is TILES, not confetti: quantized chunky pixels, grid-snapped,
      // no rotation, no drift — the face breaks into its own 4–14px blocks
      const particles = finalSources.map((p) => {
        const el = document.createElement('span')
        el.className = 'runner-pixel-particle'
        const size = [4, 6, 8][(Math.random() * 3) | 0] + (Math.random() < 0.2 ? 6 : 0)
        el.style.width = `${size}px`
        el.style.height = `${size}px`
        el.style.background = p.color
        el.style.opacity = '0'
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
        stage.appendChild(el)
        return {
          el,
          x: p.x,
          y: p.y,
          vx: Math.random() < 0.14 ? (Math.random() - 0.5) * 34 : 0,
          vy: 28 + Math.random() * 58,
          rot: 0,
          vr: 0,
          delay: p.delay,
          born: performance.now(),
          dead: false,
        }
      })
      let last = performance.now()
      const step = (now) => {
        const dt = Math.min(40, now - last) / 1000
        last = now
        let alive = 0
        for (const p of particles) {
          if (p.dead) continue
          const age = now - p.born
          if (age < p.delay) { alive += 1; continue }
          p.vy += 1250 * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
          const lifeAge = age - p.delay
          // smooth fade — holds near full briefly, eases out continuously; no buckets
          const t = Math.min(1, Math.max(0, lifeAge / 900))
          const fade = lifeAge >= 900 ? 0 : 1 - Math.pow(t, 1.5)
          if (lifeAge > 900) {
            p.dead = true
            p.el.remove()
            continue
          }
          alive += 1
          p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
          p.el.style.opacity = String(fade)
        }
        if (alive) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    } catch {
      // never let the exit animation block the game
    }
  }

  // tap the cover: the pixels shed as the game eases into existence beneath them — one
  // slow transition, not a cut — then the face yields and the run begins
  const reveal = () => {
    if (leaving) return
    setLeaving(true)
    // flip the canvas reveal right now — the game begins its slow fade-in beneath the disintegration
    setRevealing(true)
    // one additive flash at the disintegration peak — the cabinet dies with a spark
    try {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && stageRef.current) {
        const flash = document.createElement('span')
        flash.className = 'runner-flash'
        flash.setAttribute('aria-hidden', 'true')
        stageRef.current.appendChild(flash)
        window.setTimeout(() => flash.remove(), 400)
      }
    } catch { /* flash is decorative — never block the reveal */ }
    crumbleDino()
    startRef.current?.()
    leaveTimer.current = window.setTimeout(() => {
      setCovered(false)
      canvasRef.current?.focus({ preventScroll: true })
    }, 1250)
  }

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const parent = canvas.parentElement

    // ---------- state ----------
    let W = 0
    let H = 0
    let DPR = 1
    let running = true
    let visible = true
    let floorY = 0
    const stars = []
    const specks = []
    let shooter = null
    let shooterClock = 0
    const bushes = []

    // desert scrub, out among the stars: a dark clump of lobes with an
    // ion-cyan rim catching the horizon glow. Pure scenery — no collision
    const makeBush = (x) => {
      const size = rand(17, 34)
      const lobes = []
      const n = 5 + Math.floor(rand(0, 3))
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : (i / (n - 1)) - 0.5
        lobes.push({
          dx: t * size * 1.9 + rand(-1.6, 1.6),
          r: rand(size * 0.4, size * 0.68) * (1 - Math.abs(t) * 0.45),
        })
      }
      lobes.sort((a, b) => b.r - a.r) // broadest lobes first, so the rim lands on the silhouette's shoulders
      return { x, lobes, violet: Math.random() < 0.25 }
    }

    const state = {
      mode: 'idle', // idle | run | over
      distance: 0,
      speed: 3.8,
      score: 0,
      hi: 0,
      runPhase: 0,
      jump: 0,
      vy: 0,
      asteroids: [],
      spawnIn: 320,
      shake: 0,
      flashClock: 0,
      speedMark: 0,   // floor(score / 100) behind us — the arcade level
      speedFlash: 0,  // frames left of the SPEED UP callout
    }
    try {
      state.hi = Number(localStorage.getItem(HI_KEY) || '0') || 0
    } catch {
      state.hi = 0
    }

    // prerendered background: gradient field + two nebula glows + milky way band
    const bg = document.createElement('canvas')
    const paintBackground = () => {
      bg.width = W
      bg.height = H
      const b = bg.getContext('2d')
      const grad = b.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#06070c')
      grad.addColorStop(0.55, '#0a0a12')
      grad.addColorStop(1, '#070709')
      b.fillStyle = grad
      b.fillRect(0, 0, W, H)
      // milky way — a soft diagonal band of dense dust
      b.save()
      b.translate(W / 2, H / 2)
      b.rotate(-0.42)
      const band = b.createLinearGradient(0, -H, 0, H)
      band.addColorStop(0, 'rgba(190, 249, 255, 0)')
      band.addColorStop(0.42, 'rgba(190, 249, 255, 0.045)')
      band.addColorStop(0.5, 'rgba(167, 139, 250, 0.075)')
      band.addColorStop(0.58, 'rgba(190, 249, 255, 0.045)')
      band.addColorStop(1, 'rgba(190, 249, 255, 0)')
      b.fillStyle = band
      b.fillRect(-W, -H, W * 2, H * 2)
      b.restore()
      // violet nebula, upper right
      const neb1 = b.createRadialGradient(W * 0.8, H * 0.16, 0, W * 0.8, H * 0.16, H * 0.75)
      neb1.addColorStop(0, 'rgba(124, 94, 214, 0.17)')
      neb1.addColorStop(1, 'rgba(124, 94, 214, 0)')
      b.fillStyle = neb1
      b.fillRect(0, 0, W, H)
      // teal nebula, lower left
      const neb2 = b.createRadialGradient(W * 0.14, H * 0.85, 0, W * 0.14, H * 0.85, H * 0.8)
      neb2.addColorStop(0, 'rgba(33, 191, 196, 0.12)')
      neb2.addColorStop(1, 'rgba(33, 191, 196, 0)')
      b.fillStyle = neb2
      b.fillRect(0, 0, W, H)
      // perspective floor grid — the hero's horizon, redrawn in miniature
      const horizon = H - GY - 1
      const vpX = W / 2
      b.strokeStyle = 'rgba(190, 249, 255, 0.05)'
      b.lineWidth = 1
      for (let i = -9; i <= 9; i++) {
        const xTop = vpX + i * 26
        const xBottom = vpX + i * (W / 8.5)
        b.beginPath()
        b.moveTo(xTop, horizon)
        b.lineTo(xBottom, H)
        b.stroke()
      }
      for (let i = 1; i <= 6; i++) {
        const t = i / 6
        const y = horizon + Math.pow(t, 2.35) * (H - horizon) * 0.92
        b.beginPath()
        b.moveTo(0, y)
        b.lineTo(W, y)
        b.stroke()
      }
      // faint wireframe polyhedra drifting in the sky — the hero's motif, kept quiet
      const poly = (cx, cy, r, sides, rot, sx, sy) => {
        b.beginPath()
        for (let i = 0; i <= sides; i++) {
          const a = rot + (i / sides) * Math.PI * 2
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r * 0.72 * sy
          if (i === 0) b.moveTo(x, y)
          else b.lineTo(x, y)
        }
        b.stroke()
      }
      b.strokeStyle = 'rgba(94, 234, 212, 0.13)'
      b.lineWidth = 1.1
      poly(W * 0.3, H * 0.36, 48, 6, 0.35, 1, 1)       // wide hex-crystal
      poly(W * 0.68, H * 0.17, 30, 4, 0.85, 1, 1.15)   // small diamond, stretched
      b.strokeStyle = 'rgba(167, 139, 250, 0.1)'
      poly(W * 0.48, H * 0.21, 18, 3, 0.5, 1, 0.9)     // faint triangle
    }

    const seedField = () => {
      stars.length = 0
      const layers = [
        { count: 72, speed: 0.10, r: [0.4, 0.9] },
        { count: 44, speed: 0.26, r: [0.7, 1.3] },
        { count: 26, speed: 0.44, r: [0.9, 1.9] },
      ]
      for (const layer of layers) {
        for (let i = 0; i < layer.count; i++) {
          stars.push({
            x: Math.random() * W,
            y: Math.random() * (H - GY),
            layer: layer.speed,
            r: rand(layer.r[0], layer.r[1]),
            phase: rand(0, Math.PI * 2),
            tw: rand(0.012, 0.03),
          })
        }
      }
      specks.length = 0
      for (let i = 0; i < 16; i++) {
        specks.push({ x: Math.random() * W, r: rand(0.5, 1.5), alpha: rand(0.18, 0.55) })
      }
      bushes.length = 0
      const bushCount = Math.ceil(W / 230) + 2
      for (let i = 0; i < bushCount; i++) {
        bushes.push(makeBush(Math.random() * (W + 120)))
      }
      // keep the scatter from stacking into one clump
      bushes.sort((a, b) => a.x - b.x)
      for (let i = 1; i < bushes.length; i++) {
        if (bushes[i].x - bushes[i - 1].x < 110) bushes[i].x = bushes[i - 1].x + 110 + rand(0, 110)
      }
    }

    // HD pixel-art: half the backing resolution, upscaled with image-rendering —
    // chunky enough to read as pixel art, fine enough to stay legible
    const PIX = 2
    const resize = () => {
      const rect = parent.getBoundingClientRect()
      W = Math.max(1, Math.floor(rect.width))
      H = Math.max(1, Math.floor(rect.height))
      floorY = H - GY
      DPR = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.ceil((W * DPR) / PIX))
      canvas.height = Math.max(1, Math.ceil((H * DPR) / PIX))
      ctx.setTransform(DPR / PIX, 0, 0, DPR / PIX, 0, 0)
      ctx.imageSmoothingEnabled = false
      paintBackground()
      seedField()
      ctx.drawImage(bg, 0, 0)
    }

    // ---------- the constellation dinosaur ----------
    // bone lines + glowing star points; two-frame stride driven by runPhase
    const DINO_POINTS = [
      'tailTip', 'tailMid', 'pelvis', 'chest', 'shoulder', 'neck',
      'headBack', 'snout', 'jaw', 'chin', 'backKnee', 'backFoot',
      'frontKnee', 'frontFoot', 'elbow', 'hand',
    ]
    const DINO_BONES = [
      ['tailTip', 'tailMid'], ['tailMid', 'pelvis'],
      ['pelvis', 'chest'], ['chest', 'neck'], ['neck', 'headBack'],
      ['headBack', 'snout'], ['snout', 'jaw'], ['jaw', 'chin'], ['chin', 'shoulder'],
      ['chin', 'chest'],
      ['pelvis', 'backKnee'], ['backKnee', 'backFoot'],
      ['pelvis', 'frontKnee'], ['frontKnee', 'frontFoot'],
      ['shoulder', 'elbow'], ['elbow', 'hand'],
    ]
    const dinoGeometry = () => {
      const s = Math.sin(state.runPhase)
      const c = Math.cos(state.runPhase)
      const bob = Math.abs(c) * 1.6
      const base = H - GY - state.jump
      return {
        tailTip: { x: -34, y: base - 6 - bob },
        tailMid: { x: -19, y: base - 10 - bob },
        pelvis: { x: 0, y: base - 16 - bob },
        chest: { x: 14, y: base - 20 - bob },
        shoulder: { x: 22, y: base - 23 - bob },
        neck: { x: 27, y: base - 30 - bob },
        headBack: { x: 31, y: base - 33 - bob },
        snout: { x: 42, y: base - 33 - bob },
        jaw: { x: 43, y: base - 25 - bob },
        chin: { x: 27, y: base - 23 - bob },
        backKnee: { x: -6 + s * 9, y: base - 6 - bob },
        backFoot: { x: -9 + s * 13, y: base },
        frontKnee: { x: 7 - s * 9, y: base - 7 - bob },
        frontFoot: { x: 11 - s * 13, y: base },
        elbow: { x: 29, y: base - 15 - bob },
        hand: { x: 33, y: base - 10 + s * 1.6 },
      }
    }
    const drawDino = (originX) => {
      const g = dinoGeometry()
      ctx.save()
      // zoom the dino around its feet line so it gets bigger without sinking into the floor —
      // phones get a bigger bird relative to the stage
      const dinoScale = W < 720 ? 1.4 : 1.15
      const base = H - GY - state.jump
      ctx.translate(originX, base)
      ctx.scale(dinoScale, dinoScale)
      ctx.translate(0, -base)
      // flash on crash — the dino strobes hot white
      const crashed = state.mode === 'over' && Math.floor(state.flashClock) % 2 === 0
      const line = crashed ? 'rgba(255, 255, 255, 0.95)' : 'rgba(190, 249, 255, 0.52)'
      const glow = crashed ? '#ffffff' : '#d9f9fb'
      ctx.lineWidth = 1.1
      ctx.strokeStyle = line
      ctx.shadowColor = crashed ? 'rgba(255, 255, 255, 0.9)' : 'rgba(94, 234, 212, 0.75)'
      ctx.shadowBlur = crashed ? 14 : 7
      for (const [a, b] of DINO_BONES) {
        ctx.beginPath()
        ctx.moveTo(g[a].x, g[a].y)
        ctx.lineTo(g[b].x, g[b].y)
        ctx.stroke()
      }
      for (const name of DINO_POINTS) {
        const p = g[name]
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, name === 'snout' || name === 'headBack' ? 1.9 : 1.35, 0, Math.PI * 2)
        ctx.fill()
      }
      // eye — one warm ember in the constellation
      ctx.fillStyle = '#efa247'
      ctx.shadowBlur = 6
      ctx.shadowColor = '#efa247'
      ctx.beginPath()
      ctx.arc(g.headBack.x + 3.2, g.headBack.y + 1.6, 1.05, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const makeAsteroid = () => {
      const radius = rand(9.5, 17.5)
      const verts = []
      const n = 9
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + rand(-0.2, 0.2)
        const r = radius * rand(0.74, 1.18)
        verts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r })
      }
      const craters = []
      for (let i = 0; i < 3; i++) {
        craters.push({ x: rand(-0.55, 0.55) * radius, y: rand(-0.55, 0.55) * radius, r: rand(1.1, 2.5) })
      }
      return {
        type: 'rock',
        x: W + 30,
        y: H - GY - radius + rand(-1, 2),
        radius,
        verts,
        craters,
        rot: rand(0, Math.PI * 2),
        spin: rand(-0.022, 0.022),
      }
    }
    // a pine silhouette out among the stars — the cactus analog. Touch it and the run ends.
    // rim light catches the horizon, faint star points hang in the canopy
    const makeTree = () => {
      const trunkH = rand(7.5, 10.5)
      const canopyR = rand(19, 26) // widest tier half-width
      return {
        type: 'tree',
        x: W + 34,
        trunkH,
        canopyR,
        height: trunkH + canopyR * 1.9, // upper apex height above the ground
        stars: Array.from({ length: 3 }, () => ({
          dx: rand(-canopyR * 0.5, canopyR * 0.5),
          dy: -trunkH - rand(2, canopyR * 1.35),
          r: rand(0.6, 1.15),
        })),
      }
    }
    const makeFlyer = () => {
      // a pterodactyl-style shard: streaks in at speed, bobs in flight — you can't blindly jump it
      const radius = rand(7.5, 11)
      const verts = []
      const n = 7
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + rand(-0.14, 0.14)
        const spread = i % 2 === 0 ? 1.62 : 0.78 // alternating long/short points — a jagged shard
        const r = radius * spread * rand(0.82, 1.18)
        verts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r * 0.6 })
      }
      const baseY = H - GY - rand(56, 128)
      return {
        type: 'flyer',
        x: W + 40,
        y: baseY,
        baseY,
        radius,
        verts,
        rot: rand(0, Math.PI * 2),
        spin: rand(0.012, 0.03) * (Math.random() < 0.5 ? -1 : 1),
        bobPhase: rand(0, Math.PI * 2),
        bobAmp: rand(4, 9),
        bobSpeed: rand(0.085, 0.13),
      }
    }
    const drawAsteroid = (a) => {
      ctx.save()
      ctx.translate(a.x, a.y)
      ctx.rotate(a.rot)
      ctx.beginPath()
      ctx.moveTo(a.verts[0].x, a.verts[0].y)
      for (let i = 1; i < a.verts.length; i++) ctx.lineTo(a.verts[i].x, a.verts[i].y)
      ctx.closePath()
      ctx.fillStyle = '#0c0e16'
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.55)'
      ctx.lineWidth = 1.2
      ctx.shadowColor = 'rgba(124, 94, 214, 0.5)'
      ctx.shadowBlur = 9
      ctx.fill()
      ctx.stroke()
      // craters
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(5, 6, 10, 0.9)'
      for (const c of a.craters) {
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    const drawFlyer = (a) => {
      // violet comet trail streaming rightward behind the shard
      const tail = ctx.createLinearGradient(a.x, a.y, a.x + 46, a.y)
      tail.addColorStop(0, 'rgba(217, 28, 111, 0.55)')
      tail.addColorStop(0.35, 'rgba(167, 139, 250, 0.35)')
      tail.addColorStop(1, 'rgba(167, 139, 250, 0)')
      ctx.fillStyle = tail
      ctx.beginPath()
      ctx.moveTo(a.x + 5, a.y - 4.6)
      ctx.lineTo(a.x + 48, a.y - 0.4)
      ctx.lineTo(a.x + 5, a.y + 4.6)
      ctx.closePath()
      ctx.fill()
      ctx.save()
      ctx.translate(a.x, a.y)
      ctx.rotate(a.rot)
      ctx.beginPath()
      ctx.moveTo(a.verts[0].x, a.verts[0].y)
      for (let i = 1; i < a.verts.length; i++) ctx.lineTo(a.verts[i].x, a.verts[i].y)
      ctx.closePath()
      ctx.fillStyle = '#0d0b18'
      ctx.strokeStyle = 'rgba(232, 208, 255, 0.62)'
      ctx.lineWidth = 1.1
      ctx.shadowColor = 'rgba(167, 139, 250, 0.75)'
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.stroke()
      // hot ember heart — the gold in its belly
      ctx.shadowBlur = 6
      ctx.shadowColor = 'rgba(239, 162, 71, 0.9)'
      ctx.fillStyle = 'rgba(239, 162, 71, 0.92)'
      ctx.beginPath()
      ctx.arc(0, 0, a.radius * 0.32, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    const drawTree = (t) => {
      const baseY = H - GY
      const y1 = -t.trunkH // canopy base
      const h1 = t.canopyR * 1.18 // bottom tier height
      const h2 = t.canopyR * 1.02 // top tier height
      const yMid = y1 - h1 * 0.55 // overlap split between tiers
      const yTop = yMid - h2
      ctx.save()
      ctx.translate(t.x, baseY)
      // trunk
      ctx.fillStyle = '#171310'
      ctx.fillRect(-2.3, -t.trunkH, 4.6, t.trunkH)
      ctx.fillStyle = 'rgba(94, 234, 212, 0.18)'
      ctx.fillRect(1.1, -t.trunkH, 1.2, t.trunkH) // rimmed edge on the lit side
      // tier 1 — wide lower triangle
      const grad = ctx.createLinearGradient(0, yTop, 0, y1)
      grad.addColorStop(0, '#25402f')
      grad.addColorStop(1, '#121f16')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(-t.canopyR, y1)
      ctx.lineTo(t.canopyR, y1)
      ctx.lineTo(0, y1 - h1)
      ctx.closePath()
      ctx.fill()
      // tier 2 — narrower upper triangle, overlapping
      const c2 = t.canopyR * 0.66
      ctx.beginPath()
      ctx.moveTo(-c2, yMid)
      ctx.lineTo(c2, yMid)
      ctx.lineTo(0, yTop)
      ctx.closePath()
      ctx.fill()
      // ion-cyan rim along the lit slopes of both tiers
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.6)'
      ctx.lineWidth = 1.25
      ctx.shadowColor = 'rgba(94, 234, 212, 0.55)'
      ctx.shadowBlur = 5
      ctx.beginPath()
      ctx.moveTo(-t.canopyR, y1)
      ctx.lineTo(0, y1 - h1)
      ctx.lineTo(t.canopyR, y1)
      ctx.moveTo(-c2, yMid)
      ctx.lineTo(0, yTop)
      ctx.lineTo(c2, yMid)
      ctx.stroke()
      ctx.shadowBlur = 0
      // star points hung in the canopy — the constellation motif
      ctx.fillStyle = 'rgba(233, 253, 255, 0.9)'
      for (const s of t.stars) {
        ctx.beginPath()
        ctx.arc(s.dx, s.dy, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      // contact glow on the ground line
      ctx.fillStyle = 'rgba(94, 234, 212, 0.1)'
      ctx.beginPath()
      ctx.ellipse(0, 0.5, t.canopyR * 1.35, 2.2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    const asteroidHitsDino = (a, dinoX) => {
      // circle-vs-circle, forgiving hitbox — feels fair, not pixel hunting
      const dinoY = H - GY - state.jump - 17
      const dx = a.x - dinoX
      if (a.type === 'tree') {
        // one generous circle over the canopy mass — forgiving, like the asteroids
        const canopyCY = H - GY - a.trunkH - a.canopyR * 0.75
        const dy = canopyCY - dinoY
        const rr = a.canopyR * 0.88 + 8.2
        return dx * dx + dy * dy < rr * rr
      }
      const dy = a.y - dinoY
      const rr = a.radius * 0.7 + 8.2
      return dx * dx + dy * dy < rr * rr
    }

    const drawBushes = () => {
      const drift = (state.mode === 'run' ? state.speed : 1.1) * 0.55 // slower than the world — parallax depth
      for (let i = 0; i < bushes.length; i++) {
        const b = bushes[i]
        b.x -= drift
        if (b.x < -60) bushes[i] = makeBush(W + rand(30, 190))
      }
      for (const b of bushes) {
        const fill = b.violet ? '#272040' : '#1d2f27'
        const fillFar = b.violet ? '#1d1830' : '#15231d'
        const rim = b.violet ? 'rgba(167, 139, 250, 0.66)' : 'rgba(94, 234, 212, 0.6)'
        const spike = b.violet ? 'rgba(167, 139, 250, 0.34)' : 'rgba(94, 234, 212, 0.32)'
        ctx.save()
        ctx.translate(b.x, floorY + 1)
        // silhouette mass — upper semicircles sit flat on the ground line
        for (const lobe of b.lobes) {
          const grad = ctx.createLinearGradient(0, -lobe.r * 1.3, 0, 0)
          grad.addColorStop(0, fill)
          grad.addColorStop(1, fillFar)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(lobe.dx, -lobe.r * 0.18, lobe.r, Math.PI, 0)
          ctx.closePath()
          ctx.fill()
        }
        // dry spikes poking out of the scrub
        ctx.strokeStyle = spike
        ctx.lineWidth = 1
        for (let j = 0; j < b.lobes.length; j += 1) {
          const lobe = b.lobes[j]
          const lean = (j % 2 === 0 ? -1 : 1) * (0.35 + (j * 0.13) % 0.5)
          ctx.beginPath()
          ctx.moveTo(lobe.dx, -lobe.r * 0.45)
          ctx.lineTo(lobe.dx + lean * lobe.r * 1.25, -lobe.r * 1.5)
          ctx.stroke()
        }
        // rim light along the top shoulders
        ctx.strokeStyle = rim
        ctx.lineWidth = 1.25
        for (const lobe of b.lobes.slice(0, 2)) {
          ctx.beginPath()
          ctx.arc(lobe.dx, -lobe.r * 0.18, Math.max(1, lobe.r - 0.7), Math.PI * 1.2, Math.PI * 1.8)
          ctx.stroke()
        }
        // faint contact glow where the scrub meets the ground line
        ctx.fillStyle = b.violet ? 'rgba(167, 139, 250, 0.09)' : 'rgba(94, 234, 212, 0.1)'
        ctx.beginPath()
        ctx.ellipse(0, 0.5, b.lobes[0].r * 2.6, 2.2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    const drawGround = () => {
      // horizon glow — a razor of cyan with a wide soft falloff beneath
      const line = ctx.createLinearGradient(0, 0, W, 0)
      line.addColorStop(0, 'rgba(94, 234, 212, 0)')
      line.addColorStop(0.2, 'rgba(94, 234, 212, 0.55)')
      line.addColorStop(0.5, 'rgba(190, 249, 255, 0.85)')
      line.addColorStop(0.8, 'rgba(94, 234, 212, 0.55)')
      line.addColorStop(1, 'rgba(94, 234, 212, 0)')
      ctx.strokeStyle = line
      ctx.lineWidth = 1.4
      ctx.shadowColor = 'rgba(94, 234, 212, 0.85)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.moveTo(0, floorY)
      ctx.lineTo(W, floorY)
      ctx.stroke()
      ctx.shadowBlur = 0
      // drifting ground dust — moves with the world
      const drift = state.mode === 'run' ? state.speed : 1.1
      for (const s of specks) {
        s.x -= drift
        if (s.x < -3) {
          s.x = W + 3
          s.r = rand(0.5, 1.5)
          s.alpha = rand(0.18, 0.55)
        }
        ctx.globalAlpha = s.alpha
        ctx.fillStyle = 'rgba(190, 249, 255, 0.6)'
        ctx.beginPath()
        ctx.arc(s.x, floorY + 4 + s.r, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const drawStars = () => {
      for (const s of stars) {
        s.x -= (state.mode === 'run' ? state.speed : 2.4) * s.layer * 0.5
        if (s.x < -2) s.x += W + 4
        const tw = 0.55 + 0.45 * Math.sin(performance.now() * s.tw + s.phase)
        ctx.globalAlpha = tw
        ctx.fillStyle = s.layer > 0.2 ? '#e9fdff' : '#b9c7d6'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const spawnShooter = () => {
      shooter = {
        x: rand(W * 0.3, W * 0.95),
        y: rand(H * 0.05, H * 0.25),
        vx: -rand(5, 8),
        vy: rand(1.6, 2.6),
        life: 1,
      }
      shooterClock = 260 + Math.random() * 260
    }
    const drawShooter = () => {
      if (!shooter) return
      shooter.x += shooter.vx
      shooter.y += shooter.vy
      shooter.life -= 0.02
      if (shooter.life <= 0) { shooter = null; return }
      const tail = 34 * shooter.life
      const grad = ctx.createLinearGradient(shooter.x, shooter.y, shooter.x - shooter.vx * tail * 0.14, shooter.y - shooter.vy * tail * 0.14)
      grad.addColorStop(0, `rgba(255, 255, 255, ${shooter.life})`)
      grad.addColorStop(1, 'rgba(190, 249, 255, 0)')
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(shooter.x, shooter.y)
      ctx.lineTo(shooter.x - shooter.vx * tail * 0.14, shooter.y - shooter.vy * tail * 0.14)
      ctx.stroke()
    }

    const drawHud = () => {
      ctx.save()
      try { ctx.letterSpacing = '2px' } catch {}
      ctx.font = '700 17px "IBM Plex Mono", monospace'
      ctx.fillStyle = 'rgba(245, 245, 239, 0.62)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(`HI ${pad(state.hi)}  ${pad(state.score)}`, W - 14, 14)
      ctx.restore()
    }

    const drawCenterText = () => {
      ctx.save()
      ctx.textAlign = 'center'
      // the arcade level-up callout — quick in, quick out, never in the way
      if (state.mode === 'run' && state.speedFlash > 0) {
        const t = state.speedFlash / 78
        const size = Math.min(30, Math.floor(W * 0.052))
        ctx.font = `800 ${size}px Syne, system-ui, sans-serif`
        ctx.fillStyle = `rgba(233, 253, 255, ${0.15 + 0.85 * Math.sin(Math.PI * t)})`
        ctx.fillText('SPEED UP', W / 2, H * 0.26)
      }
      if (state.mode === 'idle') {
        const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.004)
        // Syne 800 is wide — size to the canvas so it always fits
        const idleSize = Math.min(44, Math.floor(W * 0.088))
        ctx.font = `800 ${idleSize}px Syne, system-ui, sans-serif`
        ctx.fillStyle = `rgba(233, 253, 255, ${0.35 + pulse * 0.65})`
        ctx.fillText('TAP TO RUN', W / 2, H * 0.32)
        ctx.font = '500 17px "IBM Plex Mono", monospace'
        ctx.fillStyle = `rgba(245, 245, 239, ${0.4 + pulse * 0.4})`
        ctx.fillText('SPACE / TAP — JUMP', W / 2, H * 0.32 + 28)
      } else if (state.mode === 'over') {
        ctx.fillStyle = 'rgba(4, 5, 9, 0.55)'
        ctx.fillRect(0, 0, W, H)
        const crashSize = Math.min(56, Math.floor(W * 0.115))
        ctx.font = `800 ${crashSize}px Syne, system-ui, sans-serif`
        ctx.fillStyle = '#ffd9de'
        ctx.shadowColor = 'rgba(217, 28, 111, 0.8)'
        ctx.shadowBlur = 0
        ctx.fillText('CRASHED', W / 2, H * 0.33)
        ctx.shadowBlur = 0
        ctx.font = '700 17px "IBM Plex Mono", monospace'
        ctx.fillStyle = 'rgba(245, 245, 239, 0.72)'
        ctx.fillText(`SCORE ${pad(state.score)}   ·   BEST ${pad(state.hi)}`, W / 2, H * 0.33 + 38)
        const blink = Math.floor(performance.now() / 480) % 2 === 0
        ctx.fillStyle = blink ? 'rgba(190, 249, 255, 0.95)' : 'rgba(190, 249, 255, 0.25)'
        ctx.fillText('TAP TO RUN AGAIN', W / 2, H * 0.33 + 62)
      }
      ctx.restore()
    }

    const resetRun = () => {
      state.mode = 'run'
      state.distance = 0
      state.speed = 3.8
      state.score = 0
      state.runPhase = 0
      state.jump = 0
      state.vy = 0
      state.asteroids.length = 0
      state.spawnIn = 420
      state.shake = 0
      state.flashClock = 0
      state.speedMark = 0
      state.speedFlash = 0
    }
    // the cover's tap starts the run directly
    startRef.current = resetRun

    const crash = () => {
      state.mode = 'over'
      state.flashClock = 10
      state.shake = 9
      if (state.score > state.hi) {
        state.hi = state.score
        hiBump()
      }
    }
    const hiBump = () => {
      try {
        localStorage.setItem(HI_KEY, String(state.hi))
      } catch {
        // private mode etc — best score just won't persist
      }
    }

    const jumpAction = () => {
      if (state.mode === 'idle' || state.mode === 'over') {
        resetRun()
        return
      }
      if (state.jump === 0) {
        state.vy = 9.6
        state.jump = 0.01
      }
    }

    // ---------- input ----------
    const dinoX = () => Math.min(150, Math.max(48, W * 0.15))
    const onPointerDown = (e) => {
      e.preventDefault()
      console.log('[runner] tap, mode=', state.mode)
      jumpAction()
    }
    // only react when the canvas itself owns focus — never hijack the page's keys
    const onKeyDown = (e) => {
      if (e.target !== canvas) return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW') {
        e.preventDefault()
        jumpAction()
      }
    }

    const step = () => {
      if (!running) return
      requestAnimationFrame(step)
      try {
        tick()
      } catch (err) {
        running = false
        console.error('[runner] step crashed', err)
      }
    }

    const tick = () => {
      ctx.drawImage(bg, 0, 0)
      const shakeX = state.shake > 0.4 ? (Math.random() - 0.5) * state.shake : 0
      const shakeY = state.shake > 0.4 ? (Math.random() - 0.5) * state.shake : 0
      if (state.shake > 0) state.shake *= 0.88
      ctx.save()
      ctx.translate(shakeX, shakeY)
      drawStars()
      drawShooter()
      drawBushes()
      drawGround()

      const runningMode = state.mode === 'run'
      if (runningMode) {
        state.distance += state.speed
        state.score = Math.floor(state.distance / 22)
        // speed is a function of score: every 100 points kicks it up a notch
        const mark = Math.floor(state.score / 100)
        if (mark > state.speedMark) {
          state.speedMark = mark
          state.speedFlash = 78
        }
        if (state.speedFlash > 0) state.speedFlash -= 1
        state.speed = Math.min(7.4, 3.8 + state.speedMark * 0.45)
        state.runPhase += state.speed * 0.062
        // jump physics — vy is positive-upward, jump is height above the floor
        if (state.jump > 0 || state.vy !== 0) {
          state.jump += state.vy
          state.vy -= 0.52
          if (state.jump <= 0 && state.vy <= 0) {
            state.jump = 0
            state.vy = 0
          }
        }
        // spawn + move asteroids
        state.spawnIn -= state.speed
        // trees hit, flyers hold off until a real run is on the board — no cheap shots
        if (state.spawnIn <= 0) {
          const roll = Math.random()
          if (state.score >= 500 && roll < 0.25) state.asteroids.push(makeFlyer())
          else if (roll < 0.62) state.asteroids.push(makeTree())
          else state.asteroids.push(makeAsteroid())
          // spacing rolls freely between a readable minimum and a wide breathing gap —
          // scaled to speed so every roll stays clearable with one jump
          state.spawnIn = Math.max(275, rand(400, 640) - Math.max(0, state.speed - 3.8) * 22)
        }
        for (let i = state.asteroids.length - 1; i >= 0; i--) {
          const a = state.asteroids[i]
          a.x -= state.speed * (a.type === 'flyer' ? 1.28 : 1)
          if (a.type !== 'tree') a.rot += a.spin
          if (a.type === 'flyer') {
            a.bobPhase += a.bobSpeed
            a.y = a.baseY + Math.sin(a.bobPhase) * a.bobAmp
          }
          if (a.x < -40) state.asteroids.splice(i, 1)
          else if (asteroidHitsDino(a, dinoX())) {
            crash()
            break
          }
        }
        // shooter timer
        shooterClock -= 1
        if (shooterClock <= 0 && !shooter && Math.random() < 0.014) spawnShooter()
      } else if (state.mode === 'over' && state.flashClock > 0) {
        state.flashClock -= 0.14
      }

      for (const a of state.asteroids) {
        if (a.type === 'flyer') drawFlyer(a)
        else if (a.type === 'tree') drawTree(a)
        else drawAsteroid(a)
      }
      drawDino(dinoX())
      drawHud()
      drawCenterText()
      ctx.restore()
    }

    // ---------- boot ----------
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    }, { rootMargin: '96px' })

    resize()
    observer.observe(canvas)

    if (reduced) {
      drawBushes()
      drawGround()
      drawDino(dinoX())
      ctx.save()
      ctx.font = '700 17px "IBM Plex Mono", monospace'
      ctx.fillStyle = 'rgba(245, 245, 239, 0.6)'
      ctx.textAlign = 'center'
      ctx.fillText('REDUCED MOTION — THE RUNNER STANDS STILL', W / 2, H * 0.3)
      ctx.restore()
      canvas.removeEventListener('pointerdown', onPointerDown)
      return () => {
        startRef.current = null
        observer.disconnect()
        window.removeEventListener('resize', resize)
      }
    }

    window.addEventListener('resize', resize)
    canvas.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    requestAnimationFrame(step)

    return () => {
      running = false
      startRef.current = null
      observer.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <section className="section section--tight" id="playground" aria-label="Galaxy runner game">
      <div className="container">
        <div className={`runner-stage${covered && !revealing ? ' is-covered' : ''}`} ref={stageRef}>
          <canvas
            ref={canvasRef}
            className="runner-canvas"
            role="application"
            tabIndex={0}
            aria-label="Galaxy dinosaur runner. Tap, click, or press Space to jump over asteroids. Space or tap restarts after a crash."
          />
          {covered && (
            <button
              type="button"
              className={`runner-cover${leaving ? ' is-leaving' : ''}`}
              onClick={reveal}
              aria-label="Play Galaxy Runner"
            >
              <span className="runner-cover-frame" aria-hidden="true" />
              <span className="runner-cover-stars" aria-hidden="true" />
              <span className="runner-cover-main">
                <span className="runner-cover-title">
                <span className="runner-cover-mask"><span className="is-filled">Galaxy</span></span>
                <span className="runner-cover-mask"><span className="is-open">Runner</span></span>
              </span>
                <svg
                  className="runner-cover-dino"
                  viewBox="-44 -40 94 46"
                  aria-hidden="true"
                  ref={dinoRef}
                >
                  <g className="runner-cover-dino-bones">
                    {COVER_DINO_BONES.map(([a, b], i) => (
                      <line key={`${a}-${b}`} x1={COVER_DINO_POINTS[a].x} y1={COVER_DINO_POINTS[a].y} x2={COVER_DINO_POINTS[b].x} y2={COVER_DINO_POINTS[b].y} style={{ '--d': `${0.45 + i * 0.055}s` }} />
                    ))}
                  </g>
                  <g className="runner-cover-dino-dots">
                    {Object.entries(COVER_DINO_POINTS).map(([name, p], i) => (
                      <circle key={name} cx={p.x} cy={p.y} r={name === 'snout' || name === 'headBack' ? 1.9 : 1.35} style={{ '--d': `${0.6 + i * 0.05}s` }} />
                    ))}
                  </g>
                  <circle className="runner-cover-dino-eye" cx={34.2} cy={-31.4} r={1.15} />
                </svg>
              </span>
              <span className="runner-cover-strip">
                <span className="runner-cover-hi">HI {pad(coverHi)}</span>
                <span className="runner-cover-cta">Click or tap to play<span className="runner-cover-dot" aria-hidden="true" /></span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
