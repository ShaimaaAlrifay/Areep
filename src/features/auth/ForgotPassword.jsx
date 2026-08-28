import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout'
import { NotConfiguredNotice } from '../../components/NotConfiguredNotice'
import { useAuthContext } from '../../contexts/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'
import { Seo } from '../../components/Seo'
import { translateAuthError } from '../../lib/constants'

export function ForgotPassword() {
  const { resetPassword } = useAuthContext()

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: resetError } = await resetPassword(email)
    setSubmitting(false)
    if (resetError) {
      setError(translateAuthError(resetError))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title="تحقق من بريدك الإلكتروني">
        <p className="text-secondary">
          إذا كان <strong>{email}</strong> مرتبطاً بحساب لدينا، فسنرسل رابط إعادة تعيين كلمة المرور إليه خلال
          دقائق.
        </p>
        <Link to="/login" className="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-6)' }}>
          العودة إلى تسجيل الدخول
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="إعادة تعيين كلمة المرور" subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين.">
      {/* noindex: a transactional utility screen with nothing to rank. */}
      <Seo title="إعادة تعيين كلمة المرور" noindex />
      {!isSupabaseConfigured && <NotConfiguredNotice />}
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
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !isSupabaseConfigured}>
          {submitting ? 'جارٍ الإرسال…' : 'إرسال رابط إعادة التعيين'}
        </button>
      </form>
      <p className="text-secondary" style={{ marginTop: 'var(--space-6)', fontSize: 14 }}>
        تذكرت كلمة المرور؟{' '}
        <Link to="/login" style={{ color: 'var(--color-accent-text)', fontWeight: 500 }}>
          سجّل الدخول
        </Link>
      </p>
    </AuthLayout>
  )
}
