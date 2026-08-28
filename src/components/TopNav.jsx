import { Link, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { EVENTS, track } from '../lib/analytics'
import { LOGO_LOCKUP_WHITE } from '../lib/brand'

export function TopNav() {
  const { user, signOut } = useAuthContext()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="topnav">
      <div className="container topnav-inner">
        <Link to={user ? '/chat' : '/'} className="brand" aria-label="أريب">
          <img src={LOGO_LOCKUP_WHITE} alt="أريب" className="brand-lockup" />
        </Link>
        <div className="topnav-actions">
          {user ? (
            <>
              <span className="text-muted topnav-email">{user.email}</span>
              <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                className="btn btn-primary"
                onClick={() => track(EVENTS.CTA_CLICK, { location: 'nav', action: 'register' })}
              >
                ابدأ مشروعك
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
