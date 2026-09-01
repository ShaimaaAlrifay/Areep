import { Navigate } from 'react-router-dom'
import { NotFound } from '../pages/NotFound'
import { useAuthContext } from '../contexts/AuthContext'
import { useSuperAdmin } from './useSuperAdmin'

/* ============================================================
   Guards every /admin route.

   A non-owner who is signed in gets the 404 page, not a "you are not
   authorised" screen. There is no reason to confirm to a random
   authenticated user that an owner console exists at this path; the
   product has one owner and everyone else should see what they would see
   for any other URL that isn't theirs.

   A signed-out visitor is sent to /login as usual — that is not a secret,
   it is the same treatment /chat gives.
   ============================================================ */
export function SuperAdminRoute({ children }) {
  const { user, loading: authLoading } = useAuthContext()
  const { loading, isAdmin, error } = useSuperAdmin()

  if (authLoading || loading) {
    return <div className="page-loading">جارٍ التحقق…</div>
  }

  if (!user) return <Navigate to="/login" replace />

  if (error) {
    return (
      <div className="ad-boot-error">
        <h1>تعذّر التحقق من الصلاحية</h1>
        <p>
          ما قدرنا نوصل لدالة <code>admin-analytics</code>. تأكد إنها منشورة على Supabase، ثم حدّث الصفحة.
        </p>
      </div>
    )
  }

  /* Rendered in place rather than redirected to, so the URL does not
     change into a confirmation that /admin is a real path. */
  if (!isAdmin) return <NotFound />

  return children
}
