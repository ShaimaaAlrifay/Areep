import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/* ============================================================
   The hero's intelligence field.

   This is the page's central metaphor, and it is taken from the brand
   mark rather than invented: the Areeb logo is six separate strokes —
   five petals and a sparkle — that only read as one shape because they
   resolve around a common centre. Scattered, they are noise. Settled,
   they are a structure. That is the product in one image, so the hero
   animates exactly that: فوضى → بنية.

   Every particle owns two positions — where it drifts when idle, and the
   seat it belongs to on the mark's silhouette. A single `order` value
   moves the whole field between them, and that value rises as the visitor
   scrolls the hero and as the pointer approaches. Reading the page is
   what resolves the picture.

   Implementation notes, all of them deliberate:
   - Canvas, not DOM: a few hundred nodes animating transform every frame
     is a compositor and style-recalc problem; one canvas is a single
     paint.
   - No animation library. GSAP + Lenis + a spring library is ~100KB of
     JavaScript before anything renders, on the one page whose job is to
     load fast for someone who has never heard of us.
   - The loop stops when the hero scrolls out of view and when the tab is
     hidden, so it never burns battery behind another section.
   - `prefers-reduced-motion` gets the resolved structure, painted once,
     with no loop at all — the metaphor still lands, it just does not move.
   ============================================================ */

/* Seat coordinates for the mark, in a unit square, traced from the real
   artwork in public/assets/areeb/logo-white.png: five petal lobes around a
   centre, plus the sparkle above. Each entry is a lobe centre and a radius
   the seats scatter within, so the silhouette reads as the logo without
   pretending to be a pixel-accurate trace. */
const LOBES = [
  { x: 0.5, y: 0.78, r: 0.1 },   // lower centre petal
  { x: 0.22, y: 0.46, r: 0.13 }, // upper left wing
  { x: 0.78, y: 0.46, r: 0.13 }, // upper right wing
  { x: 0.28, y: 0.68, r: 0.12 }, // lower left wing
  { x: 0.72, y: 0.68, r: 0.12 }, // lower right wing
  { x: 0.5, y: 0.2, r: 0.055 },  // the sparkle
]

const COUNT = 260
const IDLE_ALPHA = 0.5
const LINK_DISTANCE = 0.1

function buildParticles(random) {
  const particles = []
  for (let i = 0; i < COUNT; i += 1) {
    // Weight seats toward the larger lobes so the silhouette reads evenly.
    const lobe = LOBES[i % LOBES.length]
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * lobe.r
    particles.push({
      // where it belongs on the mark
      sx: lobe.x + Math.cos(angle) * radius,
      sy: lobe.y + Math.sin(angle) * radius * 0.92,
      // where it drifts when the field is unresolved
      cx: random(),
      cy: random(),
      // drift parameters, so no two particles move alike
      speed: 0.12 + random() * 0.3,
      phase: random() * Math.PI * 2,
      amp: 0.02 + random() * 0.05,
      size: 1 + random() * 2.1,
      // live position, filled on the first frame
      x: 0,
      y: 0,
    })
  }
  return particles
}

/** Deterministic PRNG — the field looks identical on every load, so the
 *  hero is a designed composition rather than a different picture each
 *  time (and screenshots stay comparable). */
function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const easeOut = (t) => 1 - (1 - t) * (1 - t)

export function HeroField() {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined

    const context = canvas.getContext('2d')
    const particles = buildParticles(seeded(20260829))

    let width = 0
    let height = 0
    let dpr = 1
    const pointer = { x: 0.5, y: 0.42, active: false }
    let order = reduced ? 1 : 0
    let scrollOrder = 0
    let frame = 0
    let visible = true

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    /* The mark is square, so it is fitted rather than stretched. It is
       also seated in the LEFT half on wide viewports, not centred: the
       hero's copy hangs off the right margin (this is an RTL page), and a
       centred mark resolved straight through the headline and lede. Copy
       on the reading side, image on the empty side — and the two stop
       competing. Below the breakpoint the column is single, so it recentres
       and sits behind the type as texture instead. */
    const seatToPixels = (p) => {
      const wide = width > 900
      const size = Math.min(width, height) * (wide ? 0.72 : 0.86)
      const ox = wide ? width * 0.3 - size / 2 : (width - size) / 2
      const oy = (height - size) / 2
      return { x: ox + p.sx * size, y: oy + p.sy * size }
    }

    const draw = (time) => {
      context.clearRect(0, 0, width, height)
      const accent = order

      for (const p of particles) {
        const seat = seatToPixels(p)
        const driftX = (p.cx + Math.sin(time * 0.0001 * p.speed + p.phase) * p.amp) * width
        const driftY = (p.cy + Math.cos(time * 0.00012 * p.speed + p.phase) * p.amp) * height

        // Pointer proximity resolves the field locally, so moving the
        // mouse feels like clarifying that part of the picture.
        let local = order
        if (pointer.active) {
          const dx = driftX / width - pointer.x
          const dy = driftY / height - pointer.y
          const near = Math.max(0, 1 - Math.hypot(dx, dy) / 0.34)
          local = Math.min(1, order + near * 0.55)
        }
        const t = easeOut(local)
        p.x = driftX + (seat.x - driftX) * t
        p.y = driftY + (seat.y - driftY) * t
        p.t = t
      }

      // Connections appear only as the field resolves — the structure
      // literally emerges from the noise rather than being there all along.
      if (accent > 0.12) {
        const max = LINK_DISTANCE * Math.min(width, height)
        context.lineWidth = 1
        for (let i = 0; i < particles.length; i += 1) {
          const a = particles[i]
          for (let j = i + 1; j < particles.length; j += 1) {
            const b = particles[j]
            const dx = a.x - b.x
            const dy = a.y - b.y
            const dist = Math.hypot(dx, dy)
            if (dist > max) continue
            const strength = (1 - dist / max) * (accent - 0.12) * 0.9
            if (strength <= 0.01) continue
            context.strokeStyle = `rgba(129, 140, 248, ${strength.toFixed(3)})`
            context.beginPath()
            context.moveTo(a.x, a.y)
            context.lineTo(b.x, b.y)
            context.stroke()
          }
        }
      }

      for (const p of particles) {
        // Resolved particles warm toward the accent; unresolved stay grey.
        const mix = p.t
        const r = Math.round(160 + (129 - 160) * mix)
        const g = Math.round(160 + (140 - 160) * mix)
        const b = Math.round(168 + (248 - 168) * mix)
        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${(IDLE_ALPHA + mix * 0.42).toFixed(3)})`
        context.beginPath()
        context.arc(p.x, p.y, p.size * (1 + mix * 0.5), 0, Math.PI * 2)
        context.fill()
      }
    }

    const tick = (time) => {
      // Ease toward the scroll-driven target rather than snapping, so the
      // field keeps moving for a beat after the scroll stops.
      order += (scrollOrder - order) * 0.06
      draw(time)
      frame = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      const rect = wrap.getBoundingClientRect()
      const seen = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.55)))
      scrollOrder = seen
      const nowVisible = rect.bottom > 0 && rect.top < window.innerHeight
      if (nowVisible !== visible) {
        visible = nowVisible
        if (visible && !frame && !reduced) frame = requestAnimationFrame(tick)
        if (!visible && frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
      }
    }

    const onPointerMove = (event) => {
      const rect = wrap.getBoundingClientRect()
      pointer.x = (event.clientX - rect.left) / rect.width
      pointer.y = (event.clientY - rect.top) / rect.height
      pointer.active = true
    }
    const onPointerLeave = () => {
      pointer.active = false
    }
    const onVisibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      } else if (!document.hidden && visible && !frame && !reduced) {
        frame = requestAnimationFrame(tick)
      }
    }

    resize()
    onScroll()

    if (reduced) {
      // One painted frame of the resolved structure. The idea is delivered,
      // nothing moves, and no loop is ever started.
      order = 1
      draw(0)
    } else {
      frame = requestAnimationFrame(tick)
      wrap.addEventListener('pointermove', onPointerMove)
      wrap.addEventListener('pointerleave', onPointerLeave)
    }

    const observer = new ResizeObserver(() => {
      resize()
      if (reduced) draw(0)
    })
    observer.observe(wrap)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      wrap.removeEventListener('pointermove', onPointerMove)
      wrap.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reduced])

  return (
    <div className="lp-field" ref={wrapRef} aria-hidden="true">
      <canvas ref={canvasRef} className="lp-field-canvas" />
    </div>
  )
}
