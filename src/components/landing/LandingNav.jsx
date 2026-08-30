import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LOGO_LOCKUP_WHITE } from '../../lib/brand'
import { useAuthContext } from '../../contexts/AuthContext'
import { EVENTS, track } from '../../lib/analytics'

/* ============================================================
   Floating nav for the landing page only.

   The shared <TopNav> stays exactly as it is for the legal and auth
   pages — this is a different job: it sits over the hero rather than
   above it, and condenses once the visitor has left the hero behind.
   Anchor links are real in-page hrefs, so they work with keyboard,
   middle-click and JS disabled, and CSS `scroll-behavior: smooth` does
   the easing without a scroll library.
   ============================================================ */

const LINKS = [
  { href: '#story', label: 'كيف يشتغل' },
  { href: '#capabilities', label: 'المزايا' },
  { href: '#demo', label: 'جرّبه' },
]

export function LandingNav() {
  const { user } = useAuthContext()
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      setCondensed(window.scrollY > 80)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const cta = user ? { to: '/chat', label: 'افتح مشاريعك' } : { to: '/register', label: 'ابدأ الآن' }

  return (
    <header className={`lp-nav${condensed ? ' is-condensed' : ''}`}>
      <nav className="lp-nav-inner" aria-label="التنقّل الرئيسي">
        <Link to="/" className="lp-nav-brand" aria-label="أريب — الصفحة الرئيسية">
          <img src={LOGO_LOCKUP_WHITE} alt="أريب" />
        </Link>

        <ul className="lp-nav-links">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>

        <div className="lp-nav-actions">
          {!user && (
            <Link to="/login" className="lp-nav-signin">
              دخول
            </Link>
          )}
          <Link
            to={cta.to}
            className="lp-btn lp-btn-primary lp-btn-sm"
            onClick={() => track(EVENTS.CTA_CLICK, { location: 'nav', action: user ? 'workspace' : 'register' })}
          >
            {cta.label}
          </Link>
        </div>
      </nav>
    </header>
  )
}
