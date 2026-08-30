import { useEffect, useRef } from 'react'
import { LOGO_MARK_WHITE } from '../../lib/brand'
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
   scrolls and as the pointer approaches. Reading the page is what
   resolves the picture.

   The hero is pinned while that happens (.lp-hero-scroll in landing.css).
   It used to resolve against how far the hero had scrolled *past* the
   top, which meant the mark only finished assembling once the hero was
   already leaving — the payoff played to an empty screen.

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

/* Seat coordinates come from the real artwork, not from an approximation.

   They used to be six hand-placed circles "traced from" the logo. Five
   overlapping discs plus a dot do not read as the Areeb mark — they read
   as a blob, which is exactly what the resolved hero showed. The mark has
   five petals with real negative space between them and a four-point
   sparkle above; none of that survives being approximated by circles.

   So the silhouette is sampled from public/assets/areeb/logo-white.png
   itself: draw it small, read the alpha channel, and take seats from the
   opaque pixels. The mark is then always correct by construction, and a
   future change to the artwork moves the particles with it instead of
   silently drifting out of sync with the brand.

   Sampling is stratified over a grid rather than uniformly random: 260
   points scattered at random over a shape this size leave visible clumps
   and holes, while one point per occupied cell distributes them evenly
   enough that the silhouette reads.

   The circles below survive only as the seats used for the first frames,
   before the image has decoded. They are never what the visitor ends up
   looking at. */
const FALLBACK_LOBES = [
  { x: 0.5, y: 0.78, r: 0.1 },
  { x: 0.22, y: 0.46, r: 0.13 },
  { x: 0.78, y: 0.46, r: 0.13 },
  { x: 0.28, y: 0.68, r: 0.12 },
  { x: 0.72, y: 0.68, r: 0.12 },
  { x: 0.5, y: 0.2, r: 0.055 },
]

/* Fraction of the pinned travel spent assembling. The rest is a hold on
   the finished mark — releasing the pin the instant the last particle
   seats would flick the page onward before anyone registered the shape.

   Measured rather than guessed: `order` eases toward its target and the
   seating curve is easeOut, so the field *looks* finished noticeably
   before this value is reached. At 0.6 it read as complete only 40% of
   the way in, leaving most of the pin as dead scroll. */
const ASSEMBLE_BY = 0.8

const COUNT = 260
const IDLE_ALPHA = 0.5
/* Link reach, as a fraction of the smaller canvas axis. Tightened from
   0.1 once the seats came from the real artwork: at that reach the web
   bridged the gaps between the petals and filled in the mark's negative
   space, which is most of what makes it recognisable. 0.075 keeps each
   petal densely meshed while leaving the gaps open. */
const LINK_DISTANCE = 0.075

/**
 * Reads the mark's silhouette out of its own PNG and returns `count` seats
 * in a unit square.
 *
 * The image is letterboxed into that square rather than stretched to it —
 * the artwork is 1271x1132, and normalising each axis independently would
 * squash the mark by about 11%.
 *
 * Stratified over a grid: cell size is chosen so the number of occupied
 * cells lands near `count`, then one jittered point is taken per occupied
 * cell. Uniform random sampling of the same pixels gives the same average
 * density but visibly clumps at this point count.
 *
 * Resolves to null on any failure (image missing, decode error, a tainted
 * canvas) so the caller can simply keep the seats it already has.
 */
async function seatsFromArtwork(src, count, random) {
  try {
    const image = new Image()
    image.src = src
    await image.decode()

    const RES = 260
    const scale = Math.min(RES / image.naturalWidth, RES / image.naturalHeight)
    const w = Math.max(1, Math.round(image.naturalWidth * scale))
    const h = Math.max(1, Math.round(image.naturalHeight * scale))

    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const g = off.getContext('2d', { willReadFrequently: true })
    if (!g) return null
    g.drawImage(image, 0, 0, w, h)
    const { data } = g.getImageData(0, 0, w, h)

    // Letterbox offsets: centre the shorter axis inside the unit square.
    const span = Math.max(w, h)
    const offX = (span - w) / 2
    const offY = (span - h) / 2

    /* Cell size from the filled area: one seat per cell means
       filled / cell^2 ~= count. */
    let filled = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] > 128) filled += 1
    if (!filled) return null
    const cell = Math.max(2, Math.round(Math.sqrt(filled / count)))

    const seats = []
    for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        const hits = []
        for (let y = cy; y < Math.min(cy + cell, h); y += 1) {
          for (let x = cx; x < Math.min(cx + cell, w); x += 1) {
            if (data[(y * w + x) * 4 + 3] > 128) hits.push([x, y])
          }
        }
        if (!hits.length) continue
        const [px, py] = hits[Math.floor(random() * hits.length)]
        seats.push({ sx: (px + offX) / span, sy: (py + offY) / span })
      }
    }
    if (seats.length < count * 0.5) return null

    /* Trim or pad to exactly `count`. Trimming removes evenly spaced
       entries rather than a contiguous block, so no region thins out. */
    if (seats.length > count) {
      const step = seats.length / count
      const picked = []
      for (let i = 0; i < count; i += 1) picked.push(seats[Math.floor(i * step)])
      return picked
    }
    while (seats.length < count) seats.push(seats[Math.floor(random() * seats.length)])
    return seats
  } catch {
    return null
  }
}

function buildParticles(random) {
  const particles = []
  for (let i = 0; i < COUNT; i += 1) {
    const lobe = FALLBACK_LOBES[i % FALLBACK_LOBES.length]
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
    /* The tall sticky track from landing.css. Absent only if the hero is
       ever rendered outside it, which the fallback in onScroll covers. */
    const track = wrap.closest('.lp-hero-scroll')
    const particles = buildParticles(seeded(20260829))
    let cancelled = false

    /* Seats start as the fallback circles and are replaced the moment the
       artwork decodes — usually within the first few frames, and always
       while the field is still unresolved, so nothing visibly jumps. */
    seatsFromArtwork(LOGO_MARK_WHITE, COUNT, seeded(70701337)).then((seats) => {
      if (cancelled || !seats) return
      for (let i = 0; i < particles.length; i += 1) {
        particles[i].sx = seats[i].sx
        particles[i].sy = seats[i].sy
      }
      if (reduced) draw(0)
    })

    let width = 0
    let height = 0
    let dpr = 1
    /* `to` is where the cursor actually is; `x`/`y` chase it a little each
        frame, and `power` fades the whole influence in and out. Reading the
        raw cursor position made the field snap under the mouse — the eased
        pair is what turns it into a drift. */
    const pointer = { x: 0.5, y: 0.42, toX: 0.5, toY: 0.42, power: 0, toPower: 0 }
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

    /* The mark is square, so it is fitted rather than stretched — and on a
       wide viewport it is seated inside the SAME grid the copy uses, not at
       a fraction of the raw viewport.

       That distinction is the whole point. The copy lives in .lp-shell,
       which is capped at --lp-max and centred; the mark used to be placed
       at 30% of the full window width. On a normal screen those two happen
       to sit apart, but past roughly 1900px the shell stops growing while
       the window keeps going, so the mark drifts right, straight underneath
       the headline. Measuring both from the shell's own box means they can
       never converge, at any width.

       The mark takes the leading (left, in RTL) 46% of that box and the
       copy is padded off the same 46% in CSS, so the two occupy opposite
       halves of one column by construction rather than by luck. */
    const seatToPixels = (p) => {
      const wide = width > 900

      if (!wide) {
        // Single column: the mark recentres and sits behind the type as
        // texture rather than beside it.
        const size = Math.min(width, height) * 0.86
        return { x: (width - size) / 2 + p.sx * size, y: (height - size) / 2 + p.sy * size }
      }

      /* Mirrors the CSS exactly: .lp-shell is max-width --lp-max (1240)
         with clamp(20, 5vw, 64) gutters, and .lp-hero-copy is
         min(640px, 55%) of that shell's content, hugging its leading
         (right) edge. The mark is centred in what remains to the left of
         it — INSIDE the shell, not in the open space beyond it.

         Both halves of that matter. Deriving the zone from the shell is
         what stopped the mark drifting under the headline on a wide
         screen, where the shell stops growing but the window does not.
         Keeping it inside the shell is what stops the composition going
         left-heavy at 2940px, with the artwork running to the window edge
         while the copy stayed in a centred column — the whole page is
         built on this grid, and the hero is not the place to leave it. */
      const gutter = Math.min(64, Math.max(20, width * 0.05))
      const shellWidth = Math.min(1240, width - gutter * 2)
      const shellLeft = (width - shellWidth) / 2
      const contentLeft = shellLeft + gutter
      const contentWidth = shellWidth - gutter * 2

      const copyWidth = Math.min(640, contentWidth * 0.55)
      const copyLeft = contentLeft + contentWidth - copyWidth

      const zoneLeft = contentLeft
      const zoneRight = copyLeft - 48 // a breathing gap the mark never crosses
      const zoneWidth = Math.max(120, zoneRight - zoneLeft)

      const size = Math.min(zoneWidth, height * 0.68)
      const ox = zoneLeft + (zoneWidth - size) / 2
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
        if (pointer.power > 0.001) {
          const dx = driftX / width - pointer.x
          const dy = driftY / height - pointer.y
          /* A wider, softer falloff than a linear one: squaring the ramp
             means the influence tapers off gradually at its edge instead of
             ending on a visible circle. */
          const t = Math.max(0, 1 - Math.hypot(dx, dy) / 0.42)
          local = Math.min(1, order + t * t * 0.5 * pointer.power)
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
      // The pointer is eased on both axes and in strength, at a low rate —
      // this is what makes the interaction read as the field noticing you
      // rather than reacting to you.
      pointer.x += (pointer.toX - pointer.x) * 0.045
      pointer.y += (pointer.toY - pointer.y) * 0.045
      pointer.power += (pointer.toPower - pointer.power) * 0.03
      draw(time)
      frame = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      const rect = wrap.getBoundingClientRect()

      /* Progress has to be read from the TRACK, not from this element.
         The hero is sticky now, so while it is pinned its own rect sits
         still at the top of the viewport and would report no progress at
         all. The track is the tall parent that actually scrolls. */
      const trackRect = track ? track.getBoundingClientRect() : rect
      const travel = trackRect.height - window.innerHeight

      if (travel > 0) {
        const through = Math.min(1, Math.max(0, -trackRect.top / travel))
        /* Finish assembling within the first ASSEMBLE_BY of the travel and
           hold the resolved mark for what remains, so the visitor sees the
           completed shape before the pin lets go. */
        scrollOrder = Math.min(1, through / ASSEMBLE_BY)
      } else {
        /* No travel: the pin is off (phone, or reduced motion), so fall
           back to the hero's own scroll. The divisor is smaller than the
           old 0.55 on purpose — unpinned, the hero leaves quickly, and the
           field has to be finished while it is still on screen. */
        scrollOrder = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.3)))
      }

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
      pointer.toX = (event.clientX - rect.left) / rect.width
      pointer.toY = (event.clientY - rect.top) / rect.height
      pointer.toPower = 1
    }
    const onPointerLeave = () => {
      pointer.toPower = 0
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
      cancelled = true
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
