import { useEffect, useRef, useState } from 'react'

/**
 * Fires once when an element first enters the viewport — the trigger
 * behind every scroll reveal on the landing page.
 *
 * IntersectionObserver rather than a scroll listener on purpose: the
 * callback runs off the main thread's scroll path, so a page with a few
 * dozen reveals still scrolls at full rate. It also unobserves itself the
 * moment it fires, because these reveals never play twice — content that
 * re-animates every time it scrolls back into view reads as a glitch, not
 * as craft.
 *
 * `rootMargin` defaults to a negative bottom inset so an element starts
 * revealing slightly *after* its top edge appears, which is what makes the
 * motion feel connected to the scroll instead of firing at the very edge.
 */
export function useInView({ threshold = 0.15, rootMargin = '0px 0px -12% 0px', enabled = true } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setInView(true)
      return undefined
    }
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin, enabled])

  return [ref, inView]
}

/**
 * Reports how far a tall element has been scrolled through, 0 → 1.
 *
 * Used by the pinned narrative section to drive which act is showing. This
 * one does listen to scroll, because it needs a continuous value rather
 * than a threshold crossing — but it only reads geometry inside a
 * requestAnimationFrame, never writes layout, so it cannot cause a
 * synchronous reflow while the user is scrolling.
 */
export function useScrollProgress(enabled = true) {
  const ref = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined
    const node = ref.current
    if (!node) return undefined

    let frame = 0
    const measure = () => {
      frame = 0
      const rect = node.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      if (travel <= 0) {
        setProgress(0)
        return
      }
      const value = Math.min(1, Math.max(0, -rect.top / travel))
      setProgress(value)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [enabled])

  return [ref, progress]
}
