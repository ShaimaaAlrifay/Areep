import { useState } from 'react'
import { lookupUserUsage, resetUserLimits, setUserLimits } from '../settings/client'
import { formatRelativeDate } from '../../lib/constants'
import { Panel } from './Section'

const ERROR_MESSAGES = {
  forbidden: 'هذا البحث للمالك فقط.',
  not_configured: 'Supabase غير مهيأ في هذي النسخة.',
  unavailable: 'تعذّر البحث. حاول مرة ثانية.',
  invalid_limit: 'كل حد مُدخل يجب أن يكون رقمًا صحيحًا أكبر من صفر، أو فاضي لاستخدام الحد العام.',
}

const OVERRIDE_FIELDS = [
  { key: 'tokensPerMonth', label: 'Monthly Tokens' },
  { key: 'requestsPerDay', label: 'Daily Requests' },
  { key: 'maxProjectsPerUser', label: 'Max Projects' },
  { key: 'maxPrdGenerationsPerMonth', label: 'PRDs / Month' },
  { key: 'maxRegenerationsPerProject', label: 'Regenerations / Project' },
  { key: 'maxTokensPerRequest', label: 'Max Tokens / Request' },
]

const KIND_LABEL = { discovery: 'اكتشاف', prd: 'توليد PRD', regeneration: 'إعادة توليد' }

function draftFromLimits(limits) {
  return Object.fromEntries(OVERRIDE_FIELDS.map((f) => [f.key, String(limits[f.key] ?? '')]))
}

/* ============================================================
   The "separate, logged lookup by id" this page's own copy already
   promised instead of a browsable user table (see the privacy note this
   panel replaces) — one user at a time, by email or id, on demand.
   Every admin action here (search, override, reset) goes through
   admin-settings, which console.warns on failure the same way every
   other admin write in this app already does; that plus the two-gate
   check (verify_jwt + app_admins) is this Private Beta's audit trail.
   ============================================================ */
export function UserUsageLookup() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedNote, setSavedNote] = useState(false)

  const runSearch = async (e) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setSavedNote(false)
    setSaveError(null)
    const { data, error: searchError } = await lookupUserUsage(trimmed)
    setLoading(false)
    if (searchError) {
      setError(searchError)
      setResult(null)
      return
    }
    setResult(data)
    if (data?.found) setDraft(draftFromLimits(data.limits))
  }

  const handleSave = async () => {
    if (!result?.found) return
    const payload = {}
    for (const f of OVERRIDE_FIELDS) {
      const raw = draft[f.key]?.trim()
      if (raw === '' || raw === undefined) {
        payload[f.key] = null
        continue
      }
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1) {
        setSaveError('invalid_limit')
        return
      }
      payload[f.key] = n
    }

    setSaving(true)
    setSaveError(null)
    setSavedNote(false)
    const { data, error: setError_ } = await setUserLimits(result.userId, payload)
    setSaving(false)
    if (setError_) {
      setSaveError(setError_)
      return
    }
    setResult(data)
    setDraft(draftFromLimits(data.limits))
    setSavedNote(true)
  }

  const handleReset = async () => {
    if (!result?.found) return
    const confirmed = window.confirm('متأكد إنك تبي تلغي الحدود المخصصة لهذا المستخدم وترجعه للحد العام؟')
    if (!confirmed) return
    setSaving(true)
    setSaveError(null)
    setSavedNote(false)
    const { data, error: resetError } = await resetUserLimits(result.userId)
    setSaving(false)
    if (resetError) {
      setSaveError(resetError)
      return
    }
    setResult(data)
    setDraft(draftFromLimits(data.limits))
    setSavedNote(true)
  }

  return (
    <div className="ad-user-lookup">
      <form className="ad-user-lookup-search" onSubmit={runSearch}>
        <input
          type="text"
          placeholder="بريد إلكتروني أو معرّف مستخدم"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          dir="ltr"
        />
        <button type="submit" className="ad-btn ad-btn-primary" disabled={loading || !query.trim()}>
          {loading ? 'جارٍ البحث…' : 'بحث'}
        </button>
      </form>

      {error && <p className="ad-limit-error">{ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unavailable}</p>}

      {result && !result.found && <p className="ad-note">ما لقينا مستخدمًا بهذا البريد أو المعرّف.</p>}

      {result?.found && (
        <div className="ad-user-lookup-result">
          <dl className="ad-defs">
            <div>
              <dt>الحساب</dt>
              <dd dir="ltr">{result.email}</dd>
            </div>
            <div>
              <dt>مسجّل منذ</dt>
              <dd>{result.signedUpAt ? formatRelativeDate(result.signedUpAt) : '—'}</dd>
            </div>
            <div>
              <dt>الحدود المطبّقة</dt>
              <dd>{result.hasOverride ? 'حدود مخصصة لهذا المستخدم' : 'الحد العام'}</dd>
            </div>
          </dl>

          <div className="ad-limit-usage">
            <div>
              {/* <bdi> stops the browser's bidi algorithm from visually
                  swapping "used / limit" into "limit / used" inside this
                  RTL panel — see UsageIndicator.jsx for the same fix. */}
              <strong>
                <bdi>
                  {result.usage.tokensUsed.toLocaleString('en-US')} / {result.limits.tokensPerMonth.toLocaleString('en-US')}
                </bdi>
              </strong>
              <span>توكينز هذا الشهر</span>
            </div>
            <div>
              <strong>{result.usage.discoveryRequests}</strong>
              <span>جلسات اكتشاف</span>
            </div>
            <div>
              <strong>
                <bdi>
                  {result.usage.prdGenerations} / {result.limits.maxPrdGenerationsPerMonth}
                </bdi>
              </strong>
              <span>توليد PRD هذا الشهر</span>
            </div>
            <div>
              <strong>{result.usage.regenerations}</strong>
              <span>إعادة توليد (كل المشاريع)</span>
            </div>
          </div>

          <header className="ad-panel-head">
            <h2>Custom Limits</h2>
            <p>اترك الحقل فاضيًا لاستخدام الحد العام لذلك الحقل تحديدًا.</p>
          </header>

          <div className="ad-limit-form ad-limit-form-grid">
            {OVERRIDE_FIELDS.map((f) => (
              <label key={f.key} className="ad-limit-field">
                <span>{f.label}</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="الحد العام"
                  value={draft[f.key] ?? ''}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                    setSavedNote(false)
                    setSaveError(null)
                  }}
                />
              </label>
            ))}
          </div>

          <div className="ad-user-lookup-actions">
            <button type="button" className="ad-btn ad-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'Save User Limits'}
            </button>
            {result.hasOverride && (
              <button type="button" className="ad-btn ad-btn-ghost" onClick={handleReset} disabled={saving}>
                Reset to Default
              </button>
            )}
          </div>

          {saveError && <p className="ad-limit-error">{ERROR_MESSAGES[saveError] ?? ERROR_MESSAGES.unavailable}</p>}
          {savedNote && <p className="ad-limit-saved">تم الحفظ.</p>}

          <Panel title="آخر ٢٠ استدعاء ذكاء اصطناعي">
            {result.recentEvents.length === 0 ? (
              <p className="ad-note">ما فيه استدعاءات مسجّلة لهذا المستخدم بعد.</p>
            ) : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th scope="col">الوقت</th>
                      <th scope="col">النوع</th>
                      <th scope="col">المزوّد</th>
                      <th scope="col">التوكينز</th>
                      <th scope="col">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.recentEvents.map((e, i) => (
                      <tr key={`${e.createdAt}-${i}`}>
                        <td>{formatRelativeDate(e.createdAt)}</td>
                        <td>{KIND_LABEL[e.kind] ?? e.kind}</td>
                        <td>
                          {e.provider}
                          {e.fallback ? ' (بديل)' : ''}
                        </td>
                        <td>{e.totalTokens ?? '—'}</td>
                        <td>{e.ok ? 'نجح' : `فشل${e.errorCode ? ` — ${e.errorCode}` : ''}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
