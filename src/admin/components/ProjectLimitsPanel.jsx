import { useEffect, useState } from 'react'
import { fetchProjectLimit, setProjectLimit } from '../settings/client'
import { formatRelativeDate } from '../../lib/constants'
import { ErrorState } from './states'

const ERROR_MESSAGES = {
  forbidden: 'هذا الإعداد للمالك فقط.',
  not_configured: 'Supabase غير مهيأ في هذي النسخة.',
  unavailable: 'ما قدرنا نجيب الإعداد. تأكد إن دالة admin-settings منشورة، ثم حاول مرة ثانية.',
  invalid_limit: 'الحد يجب أن يكون رقمًا صحيحًا أكبر من صفر.',
}

/* ============================================================
   The one control on this page that changes real behaviour rather than
   just explaining it. Everything else in Settings describes the system;
   this panel governs it — so it gets its own fetch, its own save state,
   and a confirmation step before a number that blocks real users takes
   effect.

   The draft value is local state until Save is pressed on purpose: the
   database is the only source of truth for the actual limit (the
   enforcement trigger reads system_settings directly), and this input is
   just a proposal until admin_set_project_limit() accepts it. Typing a
   number here does not change what anyone can do — clicking Save,
   confirming, and a successful round trip does.
   ============================================================ */
export function ProjectLimitsPanel() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedNote, setSavedNote] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchProjectLimit().then(({ data, error: fetchError }) => {
      setLoading(false)
      if (fetchError) {
        setError(fetchError)
        return
      }
      setStatus(data)
      setDraft(String(data.maxProjectsPerUser))
    })
  }

  useEffect(load, [])

  const parsedDraft = Number(draft)
  const isValidDraft = draft.trim() !== '' && Number.isInteger(parsedDraft) && parsedDraft >= 1
  const isDirty = status && isValidDraft && parsedDraft !== status.maxProjectsPerUser

  const handleSave = async () => {
    if (!status || !isDirty) return
    const confirmed = window.confirm(
      `متأكد إنك تبي تغيّر الحد الأقصى للمشاريع من ${status.maxProjectsPerUser} إلى ${parsedDraft}؟`,
    )
    if (!confirmed) return

    setSaving(true)
    setSaveError(null)
    setSavedNote(false)
    const { data, error: setError_ } = await setProjectLimit(parsedDraft)
    setSaving(false)
    if (setError_) {
      setSaveError(setError_)
      return
    }
    setStatus(data)
    setDraft(String(data.maxProjectsPerUser))
    setSavedNote(true)
  }

  if (loading) {
    return (
      <div className="ad-panel">
        <div className="ad-panel-loading" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="ad-panel">
        <ErrorState message={ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unavailable} onRetry={load} />
      </div>
    )
  }

  return (
    <div className="ad-panel">
      <header className="ad-panel-head">
        <h2>Project Limits</h2>
        <p>الحد الأقصى لعدد المشاريع التي يمكن لأي مستخدم إنشاءها. يُطبَّق فورًا ولحظة الحفظ — لا حاجة لنشر جديد.</p>
      </header>

      <div className="ad-limit-form">
        <label className="ad-limit-field">
          <span>Maximum Projects per User</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setSavedNote(false)
              setSaveError(null)
            }}
          />
        </label>

        <button type="button" className="ad-btn ad-btn-primary" onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? 'جارٍ الحفظ…' : 'Save Changes'}
        </button>
      </div>

      {!isValidDraft && draft.trim() !== '' && (
        <p className="ad-limit-error">الحد يجب أن يكون رقمًا صحيحًا أكبر من صفر.</p>
      )}
      {saveError && <p className="ad-limit-error">{ERROR_MESSAGES[saveError] ?? ERROR_MESSAGES.unavailable}</p>}
      {savedNote && <p className="ad-limit-saved">تم الحفظ. الحد الجديد فعّال الآن لكل محاولات إنشاء المشاريع.</p>}

      <div className="ad-limit-current">
        Current Limit: <strong>{status.maxProjectsPerUser}</strong> Projects / User
        {status.updatedAt && <span className="ad-limit-updated">آخر تعديل {formatRelativeDate(status.updatedAt)}</span>}
      </div>

      <div className="ad-limit-usage">
        <div>
          <strong>{status.usage.atLimit}</strong>
          <span>Users at limit</span>
        </div>
        <div>
          <strong>{status.usage.belowLimit}</strong>
          <span>Users below limit</span>
        </div>
        <div>
          <strong>{status.usage.totalUsers}</strong>
          <span>إجمالي المستخدمين</span>
        </div>
      </div>
    </div>
  )
}
