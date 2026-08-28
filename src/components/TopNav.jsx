import { Link, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'

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
        <Link to={user ? '/chat' : '/'} className="brand">
          أريب
        </Link>
        <div className="topnav-actions">
          {user ? (
            <>
              <span className="text-muted" style={{ fontSize: 14 }}>
                {user.email}
              </span>
              <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                تسجيل الدخول
              </Link>
              <Link to="/register" className="btn btn-primary">
                ابدأ مشروعك
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
