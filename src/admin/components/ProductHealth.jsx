/* ============================================================
   The screen's first sentence.

   Deliberately not a KPI card — no number, no sparkline, no change
   percentage. It exists to answer exactly one question before anything
   else on the page competes for attention: is Areeb okay right now. A
   status pill without one is a claim; every word after it here traces
   back to a real metric that moved.
   ============================================================ */

const LABEL = {
  healthy: 'مستقر',
  watch: 'يحتاج مراجعة',
  critical: 'يحتاج تدخّل',
  insufficient: 'بيانات غير كافية',
}

export function ProductHealth({ health, loading }) {
  if (loading) {
    return (
      <div className="ad-health-banner is-loading">
        <span className="ad-skeleton" style={{ width: 120, height: 22, borderRadius: 6 }} />
        <span className="ad-skeleton" style={{ width: '60%', height: 15, borderRadius: 5, marginTop: 10 }} />
      </div>
    )
  }

  const status = health?.status ?? 'insufficient'

  return (
    <div className={`ad-health-banner is-${status}`}>
      <div className="ad-health-banner-top">
        <span className="ad-health-banner-label">حالة المنتج</span>
        <span className={`ad-health-banner-pill is-${status}`}>
          <i aria-hidden="true" />
          {LABEL[status]}
        </span>
      </div>
      <p className="ad-health-banner-summary">
        {health?.summary ?? 'البيانات الحالية غير كافية لتقييم حالة المنتج.'}
      </p>
    </div>
  )
}
