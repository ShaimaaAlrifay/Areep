import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
import { NotConfiguredNotice } from '../../components/NotConfiguredNotice'
import { useAuthContext } from '../../contexts/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'
import { translateAuthError } from '../../lib/constants'
import { EVENTS, track } from '../../lib/analytics'
import { Seo } from '../../components/Seo'

export function Login() {
  const { user, loading, signIn } = useAuthContext()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!loading && user) {
    return <Navigate to="/chat" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(translateAuthError(signInError))
      return
    }
    track(EVENTS.SIGN_IN)
    navigate('/chat')
  }

  return (
    <AuthLayout title="تسجيل الدخول" subtitle="أدخل بياناتك للوصول إلى مشاريعك.">
      <Seo
        title="تسجيل الدخول"
        description="سجّل الدخول إلى أريب للوصول إلى مشاريعك وجلسات اكتشاف المتطلبات ووثائق الـ PRD الخاصة بك."
      />
      {!isSupabaseConfigured && <NotConfiguredNotice />}
      <GoogleSignInButton />
      <form className="form" onSubmit={handleSubmit} style={{ marginTop: isSupabaseConfigured ? 0 : 'var(--space-4)' }}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !isSupabaseConfigured}>
          {submitting ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
        </button>
      </form>
      <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-6)', fontSize: 14 }}>
        <Link to="/forgot-password" className="text-secondary">
          نسيت كلمة المرور؟
        </Link>
        <p className="text-secondary">
          ليس لديك حساب؟{' '}
          <Link to="/register" style={{ color: 'var(--color-accent-text)', fontWeight: 500 }}>
            أنشئ حساباً
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
