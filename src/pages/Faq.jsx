import { Link } from 'react-router-dom'
import { FaqList } from '../components/Faq'
import { PublicPage } from '../components/PublicPage'
import { EVENTS, track } from '../lib/analytics'

export function Faq() {
  return (
    <PublicPage
      title="الأسئلة الشائعة"
      description="إجابات عن أكثر ما يُسأل عن أريب: الفرق عن المساعدات العامة، دعم اللهجات العربية، ما يحدث لبيانات عميلك، ومدى جاهزية الوثيقة للتسليم."
    >
      <div className="legal">
        <header className="legal-head">
          <h1>الأسئلة الشائعة</h1>
          <p className="text-secondary">
            ما يسأل عنه محللو ومدراء المنتج قبل أن يُدخلوا أول مشروع. لم تجد سؤالك؟ ابدأ مشروعًا تجريبيًا —
            أسرع طريقة لمعرفة إن كان أريب يناسب طريقتك.
          </p>
        </header>

        <FaqList />

        {/* The page's single primary action. A FAQ is a late-funnel page:
            someone reading it is evaluating, so the next step belongs here
            rather than making them scroll back to the nav. */}
        <div className="faq-cta">
          <p className="faq-cta-text">جاهز تجرّب على مشروع حقيقي؟</p>
          <Link
            to="/register"
            className="btn btn-primary"
            onClick={() => track(EVENTS.CTA_CLICK, { location: 'faq_footer', action: 'register' })}
          >
            ابدأ مشروعك الأول
          </Link>
        </div>
      </div>
    </PublicPage>
  )
}
