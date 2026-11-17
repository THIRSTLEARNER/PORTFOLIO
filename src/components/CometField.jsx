import { useEffect, useRef } from 'react'

function rand(min, max) {
  return Math.random() * (max - min) + min
}

export default function CometField({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    let width = 0
    let height = 0
    let dpr = 1
    let rafId = 0
    let running = true
    let visible = true
    const comets = []
    let spawnTimer = 0

    function resize() {
      width = Math.max(1, window.innerWidth)
      height = Math.max(1, window.innerHeight)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function spawnComet() {
      const fromTop = Math.random() > 0.35
      const startX = fromTop ? rand(width * 0.15, width * 1.05) : width + rand(20, 120)
      const startY = fromTop ? -rand(20, 120) : rand(height * 0.0, height * 0.45)
      const angle = rand(Math.PI * 0.64, Math.PI * 0.8)
      const speed = rand(4.8, 8.6)
      const len = rand(80, 150)
      comets.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len,
        life: 1,
        decay: rand(0.0035, 0.0065),
        width: rand(0.9, 1.5),
        hue: Math.random() > 0.45 ? '33,191,196' : '242,242,238',
      })
      if (comets.length > 3) comets.shift()
    }

    function stop() {
      running = false
      cancelAnimationFrame(rafId)
    }
    function start() {
      if (running || !visible) return
      running = true
      last = performance.now()
      rafId = requestAnimationFrame(draw)
    }
    function onVis() {
      visible = document.visibilityState === 'visible'
      if (visible) start()
      else stop()
    }

    let last = performance.now()
    function draw(now) {
      if (!running) return
      const dt = Math.min(48, now - last)
      last = now
      spawnTimer += dt
      if (spawnTimer > rand(2400, 5200) && comets.length < 2) {
        spawnTimer = 0
        spawnComet()
      }

      ctx.clearRect(0, 0, width, height)

      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i]
        c.x += c.vx * (dt / 16.67)
        c.y += c.vy * (dt / 16.67)
        c.life -= c.decay * (dt / 16.67)

        if (c.life <= 0 || c.x < -250 || c.y > height + 250) {
          comets.splice(i, 1)
          continue
        }

        const tailX = c.x - c.vx * (c.len / Math.max(1, Math.hypot(c.vx, c.vy)))
        const tailY = c.y - c.vy * (c.len / Math.max(1, Math.hypot(c.vx, c.vy)))
        const grad = ctx.createLinearGradient(c.x, c.y, tailX, tailY)
        grad.addColorStop(0, `rgba(${c.hue},${0.6 * c.life})`)
        grad.addColorStop(0.35, `rgba(${c.hue},${0.18 * c.life})`)
        grad.addColorStop(1, `rgba(${c.hue},0)`)
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(tailX, tailY)
        ctx.strokeStyle = grad
        ctx.lineWidth = c.width
        ctx.lineCap = 'round'
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(c.x, c.y, c.width + 0.7, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.45 * c.life})`
        ctx.fill()
      }

      rafId = requestAnimationFrame(draw)
    }

    resize()
    spawnComet()
    spawnTimer = 1400
    onVis()
    if (visible) rafId = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={canvasRef} className={`comet-field ${className}`.trim()} aria-hidden="true" />
}
