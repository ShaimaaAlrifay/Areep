import { Link } from 'react-router-dom'
import { formatChange, formatValue } from '../analytics/metric'
import { Sparkline } from './charts'
import { NotTracked, Skeleton } from './states'

/* ============================================================
   One number, and everything needed to judge it.

   A bare figure is not a decision. So each card carries the value, the
   direction against the comparison window, and — where the number is a
   rate — the sample it was computed from, because "100٪ تفعيل" from three
   users is noise wearing a metric's clothes.

   `available: false` takes over the whole card rather than greying out a
   digit, and the reason replaces the number. That is the difference
   between a dashboard that says "we don't measure this" and one that
   quietly implies zero.
   ============================================================ */
export function KpiCard({ label, en, metric, kind = 'number', hint, to, loading = false }) {
  if (loading) {
    return (
      <article className="ad-kpi">
        <header className="ad-kpi-head">
          <Skeleton width={90} height={13} />
        </header>
        <Skeleton width={70} height={30} />
        <Skeleton width={110} height={12} />
      </article>
    )
  }

  const body = (
    <>
      <header className="ad-kpi-head">
        <span className="ad-kpi-label">{label}</span>
        {en && <span className="ad-kpi-en">{en}</span>}
      </header>

      {!metric?.available ? (
        <NotTracked reason={metric?.reason} note={metric?.note} compact />
      ) : (
        <>
          <div className="ad-kpi-value-row">
            <strong className="ad-kpi-value">{formatValue(metric.value, kind)}</strong>
            {metric.trend?.length > 1 && <Sparkline data={metric.trend} tone={metric.status} />}
          </div>
          <div className="ad-kpi-foot">
            {metric.change !== null ? (
              <span className={`ad-change ad-change-${metric.status}`}>
                {formatChange(metric.change)}
                <em>مقارنة بالفترة السابقة</em>
              </span>
            ) : (
              <span className="ad-change ad-change-neutral">
                <em>{metric.value === null ? 'ما وصلت بيانات بعد' : 'لا توجد فترة للمقارنة'}</em>
              </span>
            )}
            {metric.sampleSize !== null && metric.sampleSize !== undefined && (
              <span className="ad-kpi-sample">من {formatValue(metric.sampleSize)}</span>
            )}
          </div>
          {(metric.note || hint) && <p className="ad-kpi-hint">{metric.note ?? hint}</p>}
        </>
      )}
    </>
  )

  /* Drill-down (§18): every card that has a page behind it is a link, so
     "why did this move?" is one click, not a hunt through the sidebar. */
  return to ? (
    <Link to={to} className="ad-kpi is-linked">
      {body}
    </Link>
  ) : (
    <article className="ad-kpi">{body}</article>
  )
}
