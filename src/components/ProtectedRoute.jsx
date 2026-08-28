import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { NotConfiguredNotice } from './NotConfiguredNotice'

/** Redirects to /login once the (async) session check resolves and finds no user. */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuthContext()

  if (!isSupabaseConfigured) {
    return (
      <div className="page">
        <div className="container" style={{ paddingBlock: 'var(--space-12)' }}>
          <NotConfiguredNotice />
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="page-loading">جارٍ التحقق من الجلسة…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
