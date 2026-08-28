import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout'
import { NotConfiguredNotice } from '../../components/NotConfiguredNotice'
import { Seo } from '../../components/Seo'
import { useAuthContext } from '../../contexts/AuthContext'
import { translateAuthError } from '../../lib/constants'
import { isSupabaseConfigured } from '../../lib/supabase'

/* ============================================================
   Sets a new password at the end of the recovery flow.

   Opening the emailed link signs the user in with a short-lived recovery
   session, so by the time this renders `user` is already populated —
   which is exactly why this route must NOT sit behind <ProtectedRoute>
   and must not redirect signed-in users away the way /login does.

   No session means the link expired, was already used, or the page was
   opened directly. That gets an explicit explanation and a way to request
   a fresh link, rather than a form that would fail on submit.
   ============================================================ */

const MIN_LENGTH = 6

export function ResetPassword() {
  const { user, loading, updatePassword } = useAuthContext()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    /* Checked here rather than left to the API: Supabase would accept the
       first field and silently ignore the mismatch, locking the user out
       with a password they think they typed twice. */
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }
    if (password.length < MIN_LENGTH) {
      setError(`كلمة المرور يجب أن تكون ${MIN_LENGTH} أحرف على الأقل.`)
      return
    }

    setSubmitting(true)
    const { error: updateError } = await updatePassword(password)
    setSubmitting(false)

    if (updateError) {
      setError(translateAuthError(updateError))
      return
    }
    navigate('/chat', { replace: true })
  }

  if (loading) {
    return <div className="page-loading">جارٍ التحقق من الرابط…</div>
  }

  if (isSupabaseConfigured && !user) {
    return (
      <AuthLayout title="الرابط غير صالح" subtitle="انتهت صلاحية رابط إعادة التعيين أو أنه استُخدم من قبل.">
        <Seo title="الرابط غير صالح" noindex />
        <p className="text-secondary">
          روابط إعادة التعيين صالحة لفترة قصيرة ولمرة واحدة. اطلب رابطًا جديدًا وستصلك رسالة خلال دقائق.
        </p>
        <Link to="/forgot-password" className="btn btn-primary btn-block" style={{ marginTop: 'var(--space-6)' }}>
          اطلب رابطًا جديدًا
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="تعيين كلمة مرور جديدة" subtitle="اختر كلمة مرور جديدة لحسابك.">
      <Seo title="تعيين كلمة مرور جديدة" noindex />
      {!isSupabaseConfigured && <NotConfiguredNotice />}
      <form className="form" onSubmit={handleSubmit}>
        {/* role="alert" so the message is announced the moment it appears —
            a sighted user sees it, a screen-reader user otherwise would not. */}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="new-password">كلمة المرور الجديدة</label>
          <input
            id="new-password"
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={`${MIN_LENGTH} أحرف على الأقل`}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            className="input"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="أعد كتابتها"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !isSupabaseConfigured}>
          {submitting ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
        </button>
      </form>
    </AuthLayout>
  )
}
