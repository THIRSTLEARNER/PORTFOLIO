import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

function makeStarTexture() {
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (ctx) {
    const mid = size / 2
    const g = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid)
    g.addColorStop(0, 'rgba(255,252,245,1)')
    g.addColorStop(0.2, 'rgba(255,245,220,0.92)')
    g.addColorStop(0.5, 'rgba(255,230,190,0.45)')
    g.addColorStop(0.8, 'rgba(255,210,150,0.12)')
    g.addColorStop(1, 'rgba(255,210,150,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(c)
}

/**
 * Round / volumetric Milky Way: spherical star distribution so the galaxy
 * reads as a 3D swirl rather than a flat disk. Differential rotation runs on
 * the CPU for maximum compatibility with Three.js r176.
 */
function makeRoundGalaxy({ count = 18000, radius = 5.0, arms = 4 } = {}) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const base = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  const phases = new Float32Array(count)
  const sizes = new Float32Array(count)

  const armOffset = (Math.PI * 2) / arms
  const spin = 3.2
  const randomness = 0.35

  const warm = new THREE.Color('#ffd9a8')
  const white = new THREE.Color('#f2f2ee')
  const teal = new THREE.Color('#21bfc4')
  const orange = new THREE.Color('#efa247')
  const dust = new THREE.Color('#e8d4ff')
  const magenta = new THREE.Color('#d91c6f')

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const rNorm = Math.pow(Math.random(), 0.55)
    const r = rNorm * radius
    const armIndex = i % arms
    const baseAngle = armIndex * armOffset
    const curve = r * spin
    const randomAngle = (Math.pow(Math.random(), 3) - 0.5) * randomness * (0.5 + rNorm)
    const angle = baseAngle + curve + randomAngle

    const theta = Math.acos(clamp(1 - 2 * Math.pow(Math.random(), 0.7), -1, 1))
    const verticalBias = 1 - rNorm

    const x = Math.sin(theta) * Math.cos(angle) * r
    const z = Math.sin(theta) * Math.sin(angle) * r
    const y = Math.cos(theta) * r * verticalBias * 0.55 + (Math.random() - 0.5) * 0.09 * r

    base[i3] = positions[i3] = x
    base[i3 + 1] = positions[i3 + 1] = y
    base[i3 + 2] = positions[i3 + 2] = z
    speeds[i] = 0.15 / (0.2 + r * 0.45) // differential: inner stars rotate faster
    phases[i] = Math.random() * Math.PI * 2
    sizes[i] = (0.6 + Math.random() * 1.8) * (1 - rNorm * 0.25)

    const core = clamp(1 - r / (radius * 0.32), 0, 1)
    const armGlow = clamp(1 - Math.abs(randomAngle) * 3.4, 0, 1) * (0.45 + (1 - rNorm) * 0.45)
    let c = new THREE.Color().lerpColors(dust, teal, clamp(rNorm * 1.05 + Math.random() * 0.2, 0, 1))
    c.lerp(white, armGlow * 0.5)
    c.lerp(warm, core * (0.9 + Math.random() * 0.12))
    if (rNorm > 0.75 && Math.random() > 0.95) c.lerp(orange, 0.55)
    if (Math.random() > 0.985) c.lerp(new THREE.Color('#ffffff'), 0.85)
    if (Math.random() > 0.992) c.lerp(magenta, 0.4)
    c.multiplyScalar(0.96)

    colors[i3] = c.r
    colors[i3 + 1] = c.g
    colors[i3 + 2] = c.b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.026,
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  return { points: new THREE.Points(geo, mat), geo, mat, base, speeds, phases, sizes }
}

function makeHaloStars(count = 1500, spread = 13) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const base = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = spread * (0.3 + Math.pow(Math.random(), 0.5) * 0.7)
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.cos(phi) * 0.5
    const z = r * Math.sin(phi) * Math.sin(theta)
    base[i3] = positions[i3] = x
    base[i3 + 1] = positions[i3 + 1] = y
    base[i3 + 2] = positions[i3 + 2] = z
    const c = new THREE.Color().setHSL(0.55, 0.22, 0.82 + Math.random() * 0.22)
    colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.02,
    map: makeStarTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    alphaTest: 0.01,
  })
  return { points: new THREE.Points(geo, mat), geo, mat, base }
}

function makeCoreSprite() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const c = size / 2
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  g.addColorStop(0, 'rgba(255,252,245,1)')
  g.addColorStop(0.06, 'rgba(255,236,205,0.9)')
  g.addColorStop(0.16, 'rgba(255,228,190,0.7)')
  g.addColorStop(0.3, 'rgba(255,214,170,0.45)')
  g.addColorStop(0.5, 'rgba(33,191,196,0.22)')
  g.addColorStop(0.7, 'rgba(239,162,71,0.12)')
  g.addColorStop(1, 'rgba(16,16,19,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(5.0, 5.0, 1)
  sprite.position.set(0, 0, 0)
  return { sprite, mat, tex }
}

function makeRoundHaze() {
  const group = new THREE.Group()
  const mk = (color, sx, sy, op, rotY, x, z) => {
    const size = 256
    const cv = document.createElement('canvas')
    cv.width = size; cv.height = size
    const ctx = cv.getContext('2d')
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      g.addColorStop(0, `rgba(${color},${op})`)
      g.addColorStop(0.35, `rgba(${color},${op * 0.45})`)
      g.addColorStop(0.7, `rgba(${color},${op * 0.15})`)
      g.addColorStop(1, `rgba(${color},0)`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }
    const tex = new THREE.CanvasTexture(cv)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    const geo = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.scale.set(sx, sy, 1)
    if (rotY != null) mesh.rotation.y = rotY
    if (x != null) mesh.position.x = x
    if (z != null) mesh.position.z = z
    group.add(mesh)
    return { mesh, mat, tex, geo }
  }
  const parts = [
    mk('33,191,196', 7.2, 5.2, 0.15, 0.25, 0.4, 0.1),
    mk('239,162,71', 5.0, 3.6, 0.12, -0.35, -0.5, -0.2),
    mk('255,214,170', 6.0, 4.2, 0.10, 0.0, 0.0, -0.6),
    mk('217,28,111', 4.0, 2.8, 0.08, 0.4, 0.3, 0.4),
  ]
  return { group, parts }
}

export default function MilkyWay({ className = '' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = reducedMq.matches
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 140)
    camera.position.set(0, 2.2, 7.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)
    container.style.cursor = reduced ? 'default' : 'grab'
    container.style.touchAction = 'none'

    const root = new THREE.Group()
    root.rotation.x = -0.45
    root.rotation.z = -0.05
    root.scale.setScalar(0.6)
    scene.add(root)

    const galaxy = makeRoundGalaxy({ arms: 4, count: reduced ? 9000 : 18000 })
    root.add(galaxy.points)
    const halo = makeHaloStars(reduced ? 750 : 1500)
    root.add(halo.points)
    const core = makeCoreSprite()
    if (core) root.add(core.sprite)
    const haze = makeRoundHaze()
    root.add(haze.group)

    const disposables = [galaxy.geo, galaxy.mat, halo.geo, halo.mat, halo.mat.map]
    if (core) disposables.push(core.mat, core.tex)
    for (const p of haze.parts) disposables.push(p.mat, p.tex, p.geo)

    let width = 1
    let height = 1
    let rafId = 0
    let running = true
    let inView = true
    let intro = 0
    let lastT = 0
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const drag = { active: false, pointerId: null, lastX: 0, lastY: 0, offsetY: 0, offsetX: 0, velocityY: 0, velocityX: 0 }

    function resize() {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      camera.aspect = width / height
      const fit = clamp(1.6 / Math.max(camera.aspect, 0.6), 1.1, 2.0)
      if (camera.aspect > 1.35) {
        camera.fov = 42
        camera.position.set(0, 2.0 * fit, 6.8)
      } else if (camera.aspect < 0.85) {
        camera.fov = 56
        camera.position.set(0, 2.6 * fit, 7.6)
      } else {
        camera.fov = 48
        camera.position.set(0, 2.2 * fit, 7.2)
      }
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    function onPointerMove(e) {
      const rect = container.getBoundingClientRect()
      mouse.tx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      mouse.ty = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
      if (drag.active && e.pointerId === drag.pointerId) {
        const dx = e.clientX - drag.lastX
        const dy = e.clientY - drag.lastY
        drag.lastX = e.clientX
        drag.lastY = e.clientY
        drag.offsetY += dx * 0.006
        drag.offsetX += dy * 0.004
        drag.offsetX = clamp(drag.offsetX, -0.9, 0.9)
        drag.velocityY = dx * 0.006
        drag.velocityX = dy * 0.004
      }
    }
    function onPointerDown(e) {
      if (reduced) return
      drag.active = true
      drag.pointerId = e.pointerId
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      drag.velocityY = 0
      drag.velocityX = 0
      container.style.cursor = 'grabbing'
      if (container.setPointerCapture) container.setPointerCapture(e.pointerId)
    }
    function endDrag(e) {
      if (!drag.active) return
      if (e && drag.pointerId != null && e.pointerId !== drag.pointerId) return
      drag.active = false
      drag.pointerId = null
      container.style.cursor = reduced ? 'default' : 'grab'
    }
    function onPointerLeave(e) { mouse.tx = 0; mouse.ty = 0; endDrag(e) }

    function renderFrame(tms) {
      const t = tms * 0.001
      const dt = lastT ? Math.min((tms - lastT) * 0.001, 0.05) : 0.016
      lastT = tms
      if (!reduced) intro = Math.min(1, intro + dt * 0.5)
      const eased = 1 - Math.pow(1 - (reduced ? 1 : intro), 3)

      mouse.x += (mouse.tx - mouse.x) * (1 - Math.pow(0.001, dt))
      mouse.y += (mouse.ty - mouse.y) * (1 - Math.pow(0.001, dt))

      if (!drag.active) {
        drag.offsetY += drag.velocityY
        drag.offsetX += drag.velocityX
        drag.velocityY *= 0.92
        drag.velocityX *= 0.92
        drag.offsetX = clamp(drag.offsetX, -0.9, 0.9)
        if (Math.abs(drag.velocityY) < 0.00008) drag.velocityY = 0
        if (Math.abs(drag.velocityX) < 0.00008) drag.velocityX = 0
      }

      // Round, spherical rotation around all axes (majestic, slower)
      root.rotation.y = t * 0.024 + drag.offsetY + mouse.x * 0.14
      root.rotation.x = -0.45 + drag.offsetX + Math.sin(t * 0.09) * 0.04 - mouse.y * 0.1
      root.rotation.z = -0.05 + Math.sin(t * 0.05) * 0.018

      // Differential rotation of galaxy stars (inner stars rotate faster)
      const gPos = galaxy.points.geometry.attributes.position.array
      for (let i = 0; i < galaxy.base.length / 3; i++) {
        const i3 = i * 3
        const speed = galaxy.speeds[i]
        const ang = t * speed
        const s = Math.sin(ang)
        const c = Math.cos(ang)
        const bx = galaxy.base[i3]
        const bz = galaxy.base[i3 + 2]
        const by = galaxy.base[i3 + 1]
        gPos[i3] = bx * c - bz * s
        gPos[i3 + 2] = bx * s + bz * c
        gPos[i3 + 1] = by + Math.sin(t * (0.45 + i * 0.0008) + i * 0.08) * 0.013
      }
      galaxy.points.geometry.attributes.position.needsUpdate = true

      // Twinkle via opacity
      const tw = 0.75 + 0.25 * Math.sin(t * 1.05)
      galaxy.points.material.opacity = (0.18 + eased * 0.82) * tw
      halo.points.material.opacity = (0.1 + eased * 0.32) * tw
      if (core) core.sprite.material.opacity = ((0.25 + eased * 0.75) + Math.sin(t * 0.8) * 0.05) * tw
      for (let i = 0; i < haze.parts.length; i++) haze.parts[i].mat.opacity = ((0.18 + eased * 0.62) * (0.82 + i * 0.1)) * tw

      renderer.render(scene, camera)
    }

    function animate(t) { if (!running) return; renderFrame(t); rafId = requestAnimationFrame(animate) }
    function stop() { running = false; cancelAnimationFrame(rafId) }
    function start() {
      if (running || reduced || !inView) return
      running = true
      lastT = 0
      rafId = requestAnimationFrame(animate)
    }
    function renderStatic() {
      intro = 1
      galaxy.points.material.opacity = 0.97
      halo.points.material.opacity = 0.36
      if (core) core.sprite.material.opacity = 0.9
      for (const p of haze.parts) p.mat.opacity = 0.26
      root.rotation.set(-0.42, 0.35, -0.05)
      renderer.render(scene, camera)
    }
    function onMotionChange() {
      reduced = reducedMq.matches
      container.style.cursor = reduced ? 'default' : 'grab'
      if (reduced) { stop(); drag.active = false; drag.offsetX = 0; drag.offsetY = 0; renderStatic() }
      else { start() }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true
      if (inView) start()
      else stop()
    }, { threshold: 0.05 })
    io.observe(container)

    container.addEventListener('pointermove', onPointerMove, { passive: true })
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointerup', endDrag)
    container.addEventListener('pointercancel', endDrag)
    container.addEventListener('pointerleave', onPointerLeave)
    reducedMq.addEventListener('change', onMotionChange)
    const onVis = () => { if (document.visibilityState === 'hidden') stop(); else start() }
    document.addEventListener('visibilitychange', onVis)

    resize()
    if (reduced) renderStatic()
    else rafId = requestAnimationFrame(animate)

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointerup', endDrag)
      container.removeEventListener('pointercancel', endDrag)
      container.removeEventListener('pointerleave', onPointerLeave)
      reducedMq.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', onVis)
      for (const d of disposables) if (d && d.dispose) d.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`milkyway-canvas ${className}`}
      aria-label="Round Milky Way galaxy (3D). Drag to orbit."
      role="img"
      tabIndex={0}
      style={{ width: '100%', height: '100%', minHeight: '320px', display: 'block' }}
    />
  )
}
