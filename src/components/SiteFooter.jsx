import { Link } from 'react-router-dom'
import { LOGO_LOCKUP_WHITE } from '../lib/brand'
import { SITE_NAME } from '../lib/site'

/**
 * Site footer for the public (marketing/auth-adjacent) pages.
 *
 * The workspace behind /chat deliberately does not use it — that surface
 * is a focused tool with its own sidebar chrome, and hanging legal links
 * off every chat screen would be noise. The links are reachable from the
 * landing page, every legal page, and the 404, which is where people
 * actually look for them.
 */
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        {/* White cut — the footer sits on the same near-black as the rest
            of the app. The lockup carries the name, so it also carries the
            accessible one: the tagline beside it stays plain text. */}
        <p className="site-footer-brand">
          <img src={LOGO_LOCKUP_WHITE} alt={SITE_NAME} className="site-footer-lockup" />
          <span className="site-footer-tagline">من فكرة مبعثرة إلى منتج واضح</span>
        </p>

        {/* A real <nav> with an accessible name: a screen-reader user
            landing here needs to know this is the footer navigation and
            not a repeat of the header's. */}
        <nav className="site-footer-nav" aria-label="روابط الموقع">
          <Link to="/faq">الأسئلة الشائعة</Link>
          <Link to="/privacy">سياسة الخصوصية</Link>
          <Link to="/terms">الشروط والأحكام</Link>
        </nav>

        <p className="site-footer-copy">
          © <span className="ltr-nums">{year}</span> {SITE_NAME}. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  )
}
