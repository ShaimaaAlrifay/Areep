import { Link } from 'react-router-dom'
import { FaqList, FAQ_ITEMS } from '../components/Faq'
import { Seo } from '../components/Seo'
import { SiteFooter } from '../components/SiteFooter'
import { Capabilities } from '../components/landing/Capabilities'
import { HeroField } from '../components/landing/HeroField'
import { LandingNav } from '../components/landing/LandingNav'
import { LiveDemo } from '../components/landing/LiveDemo'
import { Narrative } from '../components/landing/Narrative'
import { PrdBuild } from '../components/landing/PrdBuild'
import { useAuthContext } from '../contexts/AuthContext'
import { EVENTS, track } from '../lib/analytics'
import '../styles/landing.css'

/* ============================================================
   Landing page.

   Read top to bottom it is one argument, not a stack of sections:

     hero        the promise, and the metaphor the whole page runs on —
                 scattered material resolving into the shape of the mark
     story       the same promise as five acts, told by scrolling
     demo        stop describing it; watch one session run
     prd         the artefact that actually gets handed over
     caps        four design decisions, each with real output as evidence
     faq         the objections that stop a click, answered
     close       the promise restated, and the one action

   Two rules the content obeys. Nothing invented: every number, id,
   priority label and provider name on this page is taken from the running
   product, and there are no testimonials, no customer logos and no usage
   statistics because none exist yet. And nothing decorative: the hero
   field, the pinned acts and the assembling document each carry a claim
   that would otherwise have to be asserted in prose.

   The workspace's own <TopNav> is untouched — the landing page has its own
   floating nav, because it is the only page whose header sits over a hero
   rather than above content.
   ============================================================ */

export function Landing() {
  const { user } = useAuthContext()

  const primary = user
    ? { to: '/chat', label: 'افتح مشاريعك' }
    : { to: '/register', label: 'جرّب أريب' }

  return (
    <div className="lp">
      <Seo />
      <LandingNav />

      <main id="main">
        {/* The tall track the hero's assembly is paced across. The section
            inside is sticky, so the viewport is held while the field
            resolves from فوضى into بنية — the same device the narrative
            below uses. Without it the shape only finished assembling once
            the hero had already scrolled halfway off screen, which meant
            the page's central image completed for nobody. */}
        <div className="lp-hero-scroll">
          <section className="lp-hero" aria-labelledby="hero-heading">
            <HeroField />

            <div className="lp-shell lp-hero-inner">
              <p className="lp-hero-kicker">
                <span className="lp-dot" aria-hidden="true" />
                ذكاء المتطلبات — بالعربية
              </p>

              <h1 id="hero-heading" className="lp-hero-title">
                <span className="lp-line">من فكرة مبعثرة</span>
                <span className="lp-line lp-line-dim">إلى منتج واضح.</span>
              </h1>

              <p className="lp-hero-lede">
                احكِ لأريب عن مشروعك كما تتكلّم مع عميلك. يسأل عمّا نقص، يرصد التناقض، ويخرج بوثيقة متطلبات
                يقدر فريقك يبني عليها — لا ملخّص محادثة.
              </p>

              <div className="lp-hero-actions">
                <Link
                  to={primary.to}
                  className="lp-btn lp-btn-primary"
                  onClick={() => track(EVENTS.CTA_CLICK, { location: 'hero', action: user ? 'workspace' : 'register' })}
                >
                  {primary.label}
                </Link>
                <a href="#story" className="lp-btn lp-btn-ghost">
                  اكتشف كيف يعمل
                  <span className="lp-btn-arrow" aria-hidden="true">
                    ↓
                  </span>
                </a>
              </div>

              {!user && <p className="lp-hero-note">مجاني حاليًا · بدون بطاقة دفع</p>}
            </div>

            <div className="lp-hero-rail" aria-hidden="true">
              <span className="lp-num">فوضى</span>
              <span className="lp-rail-line" />
              <span className="lp-num">بنية</span>
            </div>
          </section>
        </div>

        <div id="story">
          <Narrative />
        </div>

        <LiveDemo />
        <PrdBuild />
        <Capabilities />

        <section className="lp-faq" id="faq" aria-labelledby="faq-heading">
          <div className="lp-shell lp-faq-grid">
            <div>
              <p className="lp-eyebrow">قبل أن تبدأ</p>
              <h2 id="faq-heading" className="lp-h2">
                الأسئلة التي
                <span className="lp-h2-dim"> تُسأل عادة.</span>
              </h2>
              <p className="lp-faq-more">
                <Link to="/faq">بقية الأسئلة ←</Link>
              </p>
            </div>
            <FaqList items={FAQ_ITEMS.slice(0, 5)} />
          </div>
        </section>

        <section className="lp-close" aria-labelledby="close-heading">
          <div className="lp-shell lp-close-inner">
            <h2 id="close-heading" className="lp-close-title">
              <span className="lp-line">الفكرة منك.</span>
              <span className="lp-line lp-line-dim">الوضوح علينا.</span>
            </h2>
            <Link
              to={primary.to}
              className="lp-btn lp-btn-primary lp-btn-lg"
              onClick={() => track(EVENTS.CTA_CLICK, { location: 'closing', action: user ? 'workspace' : 'register' })}
            >
              ابدأ مع أريب
            </Link>
            {!user && (
              <p className="lp-hero-note">
                عندك حساب؟ <Link to="/login">سجّل الدخول</Link>
              </p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
