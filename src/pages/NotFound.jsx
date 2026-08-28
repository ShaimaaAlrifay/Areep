import { Link, useLocation } from 'react-router-dom'
import { PublicPage } from '../components/PublicPage'
import { useAuthContext } from '../contexts/AuthContext'

/* ============================================================
   404.

   Before this existed, an unknown URL rendered an empty <div id="root">:
   a blank black page with no nav, no explanation and no way out. That is
   the state a mistyped link or a stale bookmark landed in.

   It is noindex'd — a 404 has nothing to rank, and letting one into the
   index competes with the real pages. Note that a client-routed SPA still
   answers these URLs with HTTP 200; making the status honest requires the
   host's SPA-fallback config, which is a deployment concern.

   The primary action is context-aware: sending a signed-in user to a
   marketing "start your project" button is a dead end for them, while
   sending a visitor to /chat just bounces them to /login.
   ============================================================ */

export function NotFound() {
  const { user } = useAuthContext()
  const location = useLocation()

  return (
    <PublicPage
      title="الصفحة غير موجودة"
      description="الصفحة المطلوبة غير موجودة في أريب."
      noindex
      mainClassName="container notfound-main"
    >
      <p className="notfound-code ltr-nums" aria-hidden="true">
        404
      </p>
      <h1 className="notfound-title">لا توجد صفحة هنا</h1>
      <p className="text-secondary notfound-lede">
        الرابط الذي فتحته غير صحيح، أو أن الصفحة نُقلت أو حُذفت. تحقّق من العنوان، أو ارجع إلى نقطة معروفة
        من الروابط أدناه.
      </p>

      {/* The failing path, shown because it is genuinely useful when someone
          is debugging a link they were sent — and isolated with dir="ltr"
          so a URL never reorders itself inside the RTL paragraph. */}
      <p className="notfound-path">
        <span className="text-muted">المسار المطلوب:</span>{' '}
        <code dir="ltr">{location.pathname}</code>
      </p>

      <div className="notfound-actions">
        {user ? (
          <>
            <Link to="/chat" className="btn btn-primary">
              العودة إلى مشاريعي
            </Link>
            <Link to="/faq" className="btn btn-secondary">
              الأسئلة الشائعة
            </Link>
          </>
        ) : (
          <>
            <Link to="/" className="btn btn-primary">
              العودة إلى الصفحة الرئيسية
            </Link>
            <Link to="/register" className="btn btn-secondary">
              ابدأ مشروعك
            </Link>
          </>
        )}
      </div>
    </PublicPage>
  )
}
