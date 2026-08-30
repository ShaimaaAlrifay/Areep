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

export function Register() {
  const { user, loading, signUp } = useAuthContext()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)

  if (!loading && user) {
    return <Navigate to="/chat" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { data, error: signUpError } = await signUp(email, password)
    setSubmitting(false)
    if (signUpError) {
      setError(translateAuthError(signUpError))
      return
    }
    /* Reported on account creation, not on landing in the workspace, so
       the number counts sign-ups rather than sessions. Carries whether
       the project requires email confirmation and nothing else — never
       the address itself. */
    track(EVENTS.SIGN_UP, { confirmation_required: !data?.session })

    // If email confirmation is required, Supabase returns a user but no session.
    if (data?.session) {
      navigate('/chat')
    } else {
      setNeedsEmailConfirmation(true)
    }
  }

  if (needsEmailConfirmation) {
    return (
      <AuthLayout title="تحقق من بريدك الإلكتروني">
        <p className="text-secondary">
          أرسلنا رابط تأكيد إلى <strong>{email}</strong>. افتح الرابط لتفعيل حسابك، ثم سجّل الدخول.
        </p>
        <Link to="/login" className="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-6)' }}>
          الذهاب إلى تسجيل الدخول
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="إنشاء حساب" subtitle="ابدأ في تنظيم مشاريعك ومتطلبات عملائك.">
      <Seo
        title="إنشاء حساب"
        description="أنشئ حساباً مجانياً في أريب وابدأ أول جلسة اكتشاف متطلبات مع عميلك — بلا بطاقة دفع."
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
            minLength={6}
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="6 أحرف على الأقل"
          />
        </div>
        <p className="form-note">سيتم إنشاء مساحة عمل (منظمة) خاصة بك تلقائياً عند التسجيل.</p>
        {/* The auth screens have no footer, so this is the only place the
            terms a user is agreeing to are reachable from the form that
            binds them to it. Placed above the button, where consent
            notices are actually read, rather than below it. */}
        <p className="form-note">
          بإنشاء حسابك فأنت توافق على <Link to="/terms">الشروط والأحكام</Link> و
          <Link to="/privacy"> سياسة الخصوصية</Link>، بما في ذلك إرسال محتوى جلساتك إلى مزوّدي نماذج ذكاء
          اصطناعي خارجيين لمعالجته.
        </p>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !isSupabaseConfigured}>
          {submitting ? 'جارٍ إنشاء الحساب…' : 'إنشاء حساب'}
        </button>
      </form>
      <p className="text-secondary" style={{ marginTop: 'var(--space-6)', fontSize: 14 }}>
        لديك حساب بالفعل؟{' '}
        <Link to="/login" style={{ color: 'var(--color-accent-text)', fontWeight: 500 }}>
          سجّل الدخول
        </Link>
      </p>
    </AuthLayout>
  )
}
