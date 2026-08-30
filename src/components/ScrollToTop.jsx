import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/* ============================================================
   Restores scroll position on navigation.

   A browser resets the scroll offset on a real page load, but a client-side
   router only swaps the component — so following a link from halfway down
   the landing page to /terms opened that page already scrolled into the
   middle of it, with the heading above the viewport.

   Only the pathname is watched. Reacting to the full location would also
   fire for a hash change, which would fight the in-page anchors in the
   landing nav: those are supposed to scroll *to* a section, not to the top.
   For the same reason a URL that carries a hash is left alone entirely and
   handed back to the browser's own anchor handling.

   `scroll-behavior: smooth` is set globally in index.css, so an explicit
   `instant` is needed here: a page change should arrive at the top, not
   animate there from wherever the previous page happened to be.
   ============================================================ */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash])

  return null
}
