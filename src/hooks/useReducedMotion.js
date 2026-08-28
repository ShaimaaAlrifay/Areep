import { useEffect, useState } from 'react'

/**
 * Tracks `prefers-reduced-motion`, live.
 *
 * Read as a hook rather than once at module load because the setting can
 * change mid-session (macOS and Windows both apply it immediately), and a
 * page that only samples it at boot keeps animating for someone who just
 * asked it to stop.
 *
 * The initial value is read synchronously during the first render, so a
 * motion-averse visitor never sees a frame of animation before the effect
 * runs.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
