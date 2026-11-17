import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function makeCircleTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const c = size / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.22)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function makeGlowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const c = size / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(33,191,196,0.18)')
    g.addColorStop(0.35, 'rgba(217,28,111,0.1)')
    g.addColorStop(0.65, 'rgba(239,162,71,0.05)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

export default function HeroScene({ className = '' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reduced = reducedMq.matches

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x08080a, 0.055)

    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 120)
    const camBase = new THREE.Vector3(0, 1.05, 5.9)
    camera.position.copy(camBase)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    const root = new THREE.Group()
    scene.add(root)

    // Floor grids (seamless scroll)
    const gridSize = 40
    const gridA = new THREE.GridHelper(gridSize, 40, 0xc31866, 0xc31866)
    const gridB = new THREE.GridHelper(gridSize, 40, 0xc31866, 0xc31866)
    const gridFineA = new THREE.GridHelper(gridSize, 80, 0x196bcf, 0x196bcf)
    const gridFineB = new THREE.GridHelper(gridSize, 80, 0x196bcf, 0x196bcf)
    ;[gridA, gridB].forEach((g) => {
      const mats = Array.isArray(g.material) ? g.material : [g.material]
      mats.forEach((m) => { m.transparent = true; m.opacity = 0.18 })
      g.position.y = -1.35
      root.add(g)
    })
    ;[gridFineA, gridFineB].forEach((g) => {
      const mats = Array.isArray(g.material) ? g.material : [g.material]
      mats.forEach((m) => { m.transparent = true; m.opacity = 0.07 })
      g.position.y = -1.34
      root.add(g)
    })

    // Wireframe cubes
    const cubes = new THREE.Group()
    const cubeGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55)
    const cubeMat = new THREE.MeshBasicMaterial({ color: 0x21bfc4, wireframe: true, transparent: true, opacity: 0.22 })
    const cubeMat2 = new THREE.MeshBasicMaterial({ color: 0xd91c6f, wireframe: true, transparent: true, opacity: 0.14 })
    const cubeItems = []
    const cubeOffsets = [
      [-2.4, 0.25, -0.8, 1.1, cubeMat], [2.3, 0.0, -1.3, 1.0, cubeMat2], [0.3, 0.7, -2.2, 1.2, cubeMat],
      [-1.0, -0.25, 0.2, 0.85, cubeMat2], [3.0, 0.55, -2.8, 0.95, cubeMat], [-3.1, 0.6, -2.4, 0.85, cubeMat2],
      [0.9, -0.1, -3.4, 0.8, cubeMat2], [-0.2, 0.35, 0.8, 0.7, cubeMat],
    ]
    for (const [x, y, z, s, mat] of cubeOffsets) {
      const m = new THREE.Mesh(cubeGeo, mat)
      m.position.set(x, y, z)
      m.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.4)
      m.scale.setScalar(s)
      cubes.add(m)
      cubeItems.push({ m, baseY: y, phase: Math.random() * Math.PI * 2, speed: 0.35 + Math.random() * 0.35 })
    }
    root.add(cubes)

    // Particles
    const COUNT = reduced ? 260 : 1200
    const positions = new Float32Array(COUNT * 3)
    const base = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    const phases = new Float32Array(COUNT)
    const cStart = new THREE.Color('#21bfc4')
    const cMid = new THREE.Color('#f2f2ee')
    const cEnd = new THREE.Color('#efa247')
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3
      const x = (Math.random() - 0.5) * 16
      const y = (Math.random() - 0.1) * 6.2
      const z = (Math.random() - 0.5) * 14 - 2.2
      base[i3] = positions[i3] = x
      base[i3 + 1] = positions[i3 + 1] = y
      base[i3 + 2] = positions[i3 + 2] = z
      const t = Math.random()
      const c = t < 0.6 ? cStart.clone().lerp(cMid, t / 0.6 * 0.25) : cStart.clone().lerp(cEnd, (t - 0.2) / 0.8)
      c.multiplyScalar(0.95)
      colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
      speeds[i] = 0.12 + Math.random() * 0.5
      phases[i] = Math.random() * Math.PI * 2
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const circleTex = makeCircleTexture()
    const pMat = new THREE.PointsMaterial({
      size: 0.045,
      map: circleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      alphaTest: 0.01,
    })
    const particles = new THREE.Points(pGeo, pMat)
    root.add(particles)

    // Constellation network
    const NET_COUNT = reduced ? 22 : 42
    const netIdx = []
    for (let i = 0; i < NET_COUNT; i++) netIdx.push(Math.floor(Math.random() * COUNT))
    const pairs = []
    const maxDist = 1.55
    for (let a = 0; a < NET_COUNT; a++) {
      for (let b = a + 1; b < NET_COUNT; b++) {
        const ia = netIdx[a] * 3
        const ib = netIdx[b] * 3
        const dx = base[ia] - base[ib]
        const dy = base[ia + 1] - base[ib + 1]
        const dz = base[ia + 2] - base[ib + 2]
        if (dx * dx + dy * dy + dz * dz < maxDist * maxDist) pairs.push([netIdx[a], netIdx[b]])
      }
    }
    const linePos = new Float32Array(pairs.length * 6)
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
    const lineMat = new THREE.LineBasicMaterial({ color: 0x21bfc4, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending })
    const lines = new THREE.LineSegments(lineGeo, lineMat)
    root.add(lines)

    // Glows
    const glowTex = makeGlowTexture()
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
    const glow = new THREE.Sprite(glowMat)
    glow.position.set(0.1, 0.3, -3.0)
    glow.scale.set(10.5, 6.5, 1)
    root.add(glow)
    const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }))
    glow2.position.set(-2.4, 0.6, -1.8)
    glow2.scale.set(6.5, 4.5, 1)
    root.add(glow2)
    const glow3 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }))
    glow3.position.set(2.6, -0.1, -2.6)
    glow3.scale.set(7.5, 5.0, 1)
    root.add(glow3)

    let width = 1
    let height = 1
    let rafId = 0
    let running = true
    let inView = true
    let lastT = 0
    let intro = 0
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const ripple = { active: false, t: 0, x: 0, y: 0 }

    function resize() {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      camera.aspect = width / height
      if (camera.aspect < 0.8) {
        camera.fov = 62
        camera.position.z = camBase.z + 0.2
      } else if (camera.aspect > 1.6) {
        camera.fov = 50
        camera.position.z = camBase.z
      } else {
        camera.fov = 54
        camera.position.z = camBase.z
      }
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    function onPointerMove(e) {
      const rect = container.getBoundingClientRect()
      mouse.tx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      mouse.ty = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
    }
    function onPointerLeave() { mouse.tx = 0; mouse.ty = 0 }
    function onPointerDown(e) {
      if (reduced) return
      const rect = container.getBoundingClientRect()
      ripple.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      ripple.y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
      ripple.t = 0
      ripple.active = true
    }

    function renderFrame(tms) {
      const t = tms * 0.001
      const dt = lastT ? Math.min((tms - lastT) * 0.001, 0.05) : 0.016
      lastT = tms
      if (!reduced) intro = Math.min(1, intro + dt * 0.55)
      const introEase = 1 - Math.pow(1 - (reduced ? 1 : intro), 3)

      mouse.x += (mouse.tx - mouse.x) * (1 - Math.pow(0.001, dt))
      mouse.y += (mouse.ty - mouse.y) * (1 - Math.pow(0.001, dt))

      if (ripple.active) {
        ripple.t += dt
        if (ripple.t > 1.2) ripple.active = false
      }
      const rippleAmt = ripple.active ? Math.sin((ripple.t / 1.2) * Math.PI) * (1 - ripple.t / 1.2) : 0

      root.rotation.y = mouse.x * 0.1 + ripple.x * rippleAmt * 0.06
      root.rotation.x = -mouse.y * 0.05 - ripple.y * rippleAmt * 0.04
      camera.position.x = camBase.x + mouse.x * 0.16
      camera.position.y = camBase.y + -mouse.y * 0.07 + (1 - introEase) * 0.18
      camera.position.z = camBase.z + (1 - introEase) * 0.7
      camera.lookAt(0, 0.08, -1.2)

      const loop = 2.4
      const drift = ((t * 0.22) % loop + loop) % loop
      gridA.position.z = -2.8 + drift
      gridB.position.z = -2.8 + drift - loop
      const drift2 = ((t * 0.14) % (loop / 2) + loop / 2) % (loop / 2)
      gridFineA.position.z = -2.8 + drift2
      gridFineB.position.z = -2.8 + drift2 - loop / 2

      for (const it of cubeItems) {
        it.m.rotation.x += 0.18 * dt * it.speed
        it.m.rotation.y += 0.28 * dt * it.speed
        it.m.position.y = it.baseY + Math.sin(t * it.speed + it.phase) * 0.09
      }

      const pos = pGeo.attributes.position.array
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3
        pos[i3 + 1] = base[i3 + 1] + Math.sin(t * speeds[i] + phases[i]) * 0.08
        pos[i3 + 2] += dt * 0.22 * speeds[i]
        if (pos[i3 + 2] > 4.8) {
          pos[i3 + 2] = -9.5
          base[i3] = pos[i3] = (Math.random() - 0.5) * 16
          base[i3 + 1] = (Math.random() - 0.1) * 6.2
        }
      }
      pGeo.attributes.position.needsUpdate = true
      particles.rotation.y = Math.sin(t * 0.07) * 0.03

      if (pairs.length) {
        for (let i = 0; i < pairs.length; i++) {
          const [a, b] = pairs[i]
          const o = i * 6
          linePos[o] = pos[a * 3]; linePos[o + 1] = pos[a * 3 + 1]; linePos[o + 2] = pos[a * 3 + 2]
          linePos[o + 3] = pos[b * 3]; linePos[o + 4] = pos[b * 3 + 1]; linePos[o + 5] = pos[b * 3 + 2]
        }
        lineGeo.attributes.position.needsUpdate = true
        lineMat.opacity = 0.08 + Math.sin(t * 0.8) * 0.03 + rippleAmt * 0.08
      }

      glow.material.opacity = 0.7 + Math.sin(t * 0.5) * 0.08
      glow2.material.opacity = 0.26 + Math.sin(t * 0.7 + 1) * 0.05
      glow3.material.opacity = 0.18 + Math.sin(t * 0.6 + 2) * 0.04
      pMat.opacity = 0.62 + introEase * 0.3

      renderer.render(scene, camera)
    }

    function animate(t) {
      if (!running) return
      renderFrame(t)
      rafId = requestAnimationFrame(animate)
    }
    function stop() { running = false; cancelAnimationFrame(rafId) }
    function start() {
      if (running || reduced || !inView) return
      running = true
      lastT = 0
      rafId = requestAnimationFrame(animate)
    }
    function renderStatic() {
      intro = 1
      root.rotation.set(0, 0.05, 0)
      gridA.position.z = -2.2; gridB.position.z = -4.6
      gridFineA.position.z = -2.4; gridFineB.position.z = -3.6
      pMat.opacity = 0.9
      renderer.render(scene, camera)
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
    container.addEventListener('pointerleave', onPointerLeave, { passive: true })
    container.addEventListener('pointerdown', onPointerDown, { passive: true })
    const onMotion = () => {
      if (reducedMq.matches) { stop(); renderStatic() } else { start() }
    }
    reducedMq.addEventListener('change', onMotion)
    const onVis = () => { if (document.visibilityState === 'hidden') stop(); else start() }
    document.addEventListener('visibilitychange', onVis)

    resize()
    if (reduced) {
      renderStatic()
    } else {
      rafId = requestAnimationFrame(animate)
    }

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', onPointerLeave)
      container.removeEventListener('pointerdown', onPointerDown)
      reducedMq.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVis)
      pGeo.dispose(); pMat.dispose(); circleTex.dispose()
      cubeGeo.dispose(); cubeMat.dispose(); cubeMat2.dispose()
      lineGeo.dispose(); lineMat.dispose()
      glowTex.dispose(); glowMat.dispose(); glow.material.dispose(); glow2.material.dispose(); glow3.material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} className={className} aria-hidden="true" />
}
