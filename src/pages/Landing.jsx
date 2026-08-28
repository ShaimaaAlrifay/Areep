import { Link } from 'react-router-dom'
import { FaqList, FAQ_ITEMS } from '../components/Faq'
import { Seo } from '../components/Seo'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { useAuthContext } from '../contexts/AuthContext'
import { EVENTS, track } from '../lib/analytics'

/* ============================================================
   Landing page.

   Deliberately still quiet — the design system's rule against gradient
   fields, glowing cards and heavy shadows applies here too. What was
   added is structure, not decoration: a visitor previously saw one
   headline and two buttons with no explanation of what happens after the
   click, no answers to the obvious objections, and no way to reach the
   legal pages.

   CTA policy: exactly one primary action per screenful, repeated at the
   two points where intent peaks (top, and after the FAQ). Secondary
   actions stay visually secondary. The primary changes for a signed-in
   visitor — telling someone who already has projects to "start your
   project" wastes the most valuable button on the page.
   ============================================================ */

/* The three steps mirror the real product flow — discovery chat, review
   screen, generated document — not an invented marketing funnel. */
const STEPS = [
  {
    n: '٠١',
    title: 'احكِ عن المشروع',
    body: 'ابدأ جلسة اكتشاف بالعربية كما يتكلّم عميلك. أريب يسأل عمّا نقص، ويرصد التناقضات.',
  },
  {
    n: '٠٢',
    title: 'راجِع المتطلبات',
    body: 'المتطلبات تظهر مرقّمة ومصنّفة بأولويات MoSCoW. عدّل، احذف، أضِف — الوثيقة تُبنى ممّا تعتمده.',
  },
  {
    n: '٠٣',
    title: 'صدّر الوثيقة',
    body: 'وثيقة PRD بقالب أريب: نص عربي قابل للبحث، فهرس، وترقيم. بصيغة PDF أو Markdown.',
  },
]

export function Landing() {
  const { user } = useAuthContext()

  const primary = user
    ? { to: '/chat', label: 'افتح مشاريعك' }
    : { to: '/register', label: 'ابدأ مشروعك الأول' }

  return (
    <div className="page">
      <Seo />
      <TopNav />

      <main id="main">
        <section className="hero container">
          <span className="placeholder-badge">أداة ذكاء المتطلبات لمحللي ومدراء المنتج</span>
          <h1 className="hero-title">من كلام العميل إلى PRD جاهز للتنفيذ.</h1>
          <p className="hero-lede text-secondary">
            أريب يدير جلسة اكتشاف المتطلبات مع عميلك بالعربية، يستخرج المتطلبات من المحادثة، ويحوّلها إلى
            وثيقة متطلبات منتج منظّمة — في دقائق بدل أيام من الاجتماعات والصياغة.
          </p>

          <div className="hero-actions">
            <Link
              to={primary.to}
              className="btn btn-primary btn-lg"
              onClick={() => track(EVENTS.CTA_CLICK, { location: 'hero', action: user ? 'workspace' : 'register' })}
            >
              {primary.label}
            </Link>
            {!user && (
              <Link to="/login" className="btn btn-secondary btn-lg">
                تسجيل الدخول
              </Link>
            )}
          </div>

          {/* Removes the two objections that stop a click, right where the
              click happens — both are true statements about the product. */}
          {!user && <p className="hero-reassurance text-muted">مجاني حاليًا · لا حاجة لبطاقة دفع</p>}
        </section>

        <section className="section container" aria-labelledby="how-heading">
          <h2 id="how-heading" className="section-heading">
            كيف يعمل
          </h2>
          <ol className="steps">
            {STEPS.map((step) => (
              <li key={step.n} className="step">
                <span className="step-number ltr-nums" aria-hidden="true">
                  {step.n}
                </span>
                <h3 className="step-title">{step.title}</h3>
                <p className="text-secondary step-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section container" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="section-heading">
            أسئلة قبل أن تبدأ
          </h2>
          {/* Only the first four here; the rest live on /faq so the landing
              page stays scannable instead of turning into the FAQ page. */}
          <FaqList items={FAQ_ITEMS.slice(0, 4)} />
          <p className="section-more">
            <Link to="/faq">بقية الأسئلة الشائعة ←</Link>
          </p>
        </section>

        <section className="closing-cta">
          <div className="container closing-cta-inner">
            <h2 className="closing-cta-title">جرّبه على مشروع حقيقي.</h2>
            <p className="text-secondary closing-cta-lede">
              أسرع طريقة لتعرف إن كان أريب يناسب طريقتك: جلسة واحدة مع مشروع تعرفه.
            </p>
            <Link
              to={primary.to}
              className="btn btn-primary btn-lg"
              onClick={() => track(EVENTS.CTA_CLICK, { location: 'closing', action: user ? 'workspace' : 'register' })}
            >
              {primary.label}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
