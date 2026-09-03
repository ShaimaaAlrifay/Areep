import { useEffect, useState } from 'react'
import { fetchAiLimits, setAiLimits } from '../settings/client'
import { formatRelativeDate } from '../../lib/constants'
import { ErrorState } from './states'

const ERROR_MESSAGES = {
  forbidden: 'هذا الإعداد للمالك فقط.',
  not_configured: 'Supabase غير مهيأ في هذي النسخة.',
  unavailable: 'ما قدرنا نجيب الإعداد. تأكد إن دالة admin-settings منشورة، ثم حاول مرة ثانية.',
  invalid_limit: 'كل الحدود يجب أن تكون أرقامًا صحيحة أكبر من صفر.',
}

const FIELDS = [
  { key: 'tokensPerMonth', label: 'Monthly Token Limit', hint: 'توكينز / مستخدم / شهر' },
  { key: 'requestsPerDay', label: 'Daily Requests', hint: 'طلبات ذكاء اصطناعي / مستخدم / يوم' },
  { key: 'maxTokensPerRequest', label: 'Max Tokens / Request', hint: 'سقف الطلب الواحد' },
  { key: 'maxPrdGenerationsPerMonth', label: 'PRDs / Month', hint: 'توليد وثائق / مستخدم / شهر' },
  { key: 'maxRegenerationsPerProject', label: 'Regenerations / Project', hint: 'إعادة توليد / مشروع واحد' },
]

/* ============================================================
   The global AI quota knobs — same pattern as ProjectLimitsPanel.jsx,
   which this deliberately mirrors: draft state is local until Save is
   pressed, the database (via check_and_reserve_ai_usage() in Postgres)
   is the only source of truth for what actually applies, and a save is
   effective immediately for every user with no override of their own —
   no redeploy, matching the "change 100,000 to 200,000 with no code"
   requirement this panel exists to satisfy.
   ============================================================ */
export function AiUsageLimitsPanel() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedNote, setSavedNote] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchAiLimits().then(({ data, error: fetchError }) => {
      setLoading(false)
      if (fetchError) {
        setError(fetchError)
        return
      }
      setStatus(data)
      setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key])])))
    })
  }

  useEffect(load, [])

  const parsedDraft = Object.fromEntries(FIELDS.map((f) => [f.key, Number(draft[f.key])]))
  const isValidDraft = FIELDS.every((f) => draft[f.key]?.trim() !== '' && Number.isInteger(parsedDraft[f.key]) && parsedDraft[f.key] >= 1)
  const isDirty = status && isValidDraft && FIELDS.some((f) => parsedDraft[f.key] !== status[f.key])

  const handleSave = async () => {
    if (!status || !isDirty) return
    const confirmed = window.confirm('متأكد إنك تبي تحفظ حدود استخدام الذكاء الاصطناعي الجديدة؟ التغيير يسري فورًا على كل المستخدمين بدون حد مخصص.')
    if (!confirmed) return

    setSaving(true)
    setSaveError(null)
    setSavedNote(false)
    const { data, error: setError_ } = await setAiLimits(parsedDraft)
    setSaving(false)
    if (setError_) {
      setSaveError(setError_)
      return
    }
    setStatus(data)
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key])])))
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
        <h2>AI Usage & Limits</h2>
        <p>حدود استهلاك أريب من Gemini/Groq لكل مستخدم. تُطبَّق فورًا ولحظة الحفظ — لا حاجة لنشر جديد.</p>
      </header>

      <div className="ad-limit-form ad-limit-form-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="ad-limit-field">
            <span>{f.label}</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={draft[f.key] ?? ''}
              onChange={(e) => {
                setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                setSavedNote(false)
                setSaveError(null)
              }}
            />
            <span className="ad-limit-field-hint">{f.hint}</span>
          </label>
        ))}
      </div>

      <button type="button" className="ad-btn ad-btn-primary" onClick={handleSave} disabled={!isDirty || saving}>
        {saving ? 'جارٍ الحفظ…' : 'Save Changes'}
      </button>

      {!isValidDraft && <p className="ad-limit-error">كل حد يجب أن يكون رقمًا صحيحًا أكبر من صفر.</p>}
      {saveError && <p className="ad-limit-error">{ERROR_MESSAGES[saveError] ?? ERROR_MESSAGES.unavailable}</p>}
      {savedNote && <p className="ad-limit-saved">تم الحفظ. الحدود الجديدة فعّالة الآن.</p>}

      {status.updatedAt && <p className="ad-limit-updated">آخر تعديل {formatRelativeDate(status.updatedAt)}</p>}

      <div className="ad-limit-usage">
        <div>
          <strong>{status.usage.healthy}</strong>
          <span>مستخدمون ضمن الحد بارتياح</span>
        </div>
        <div>
          <strong>{status.usage.nearLimit}</strong>
          <span>قريبون من الحد (٨٠٪+)</span>
        </div>
        <div>
          <strong>{status.usage.overLimit}</strong>
          <span>تجاوزوا الحد</span>
        </div>
      </div>
    </div>
  )
}
