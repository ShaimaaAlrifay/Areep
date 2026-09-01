import { formatValue } from '../analytics/metric'
import { NotTracked } from './states'

/* ============================================================
   Primary → failure → fallback, as a shape instead of a table row.

   The number this exists to make legible is the fallback rate, but a
   percentage alone doesn't say WHY a request took the second path. The
   diagram fixes the reading order: it is always the primary provider
   that is tried first, a failure is what hands the request off, and the
   fallback is what actually served the user. Three boxes say that in one
   glance; a number alone says only "7%".
   ============================================================ */
export function FallbackDiagram({ ai }) {
  if (!ai?.available) {
    return <NotTracked reason={ai?.reason} />
  }

  const requests = ai.requests.value ?? 0
  const fallbackServed = Math.round(((ai.fallbackRate.value ?? 0) / 100) * requests)
  const primaryDirect = requests - fallbackServed

  return (
    <div className="ad-fallback-diagram">
      <div className="ad-fallback-node ad-fallback-primary">
        <span className="ad-fallback-node-label">المزوّد الأساسي</span>
        <strong>{formatValue(requests)}</strong>
        <span className="ad-fallback-node-sub">إجمالي الطلبات</span>
      </div>

      <div className="ad-fallback-arrow" aria-hidden="true">
        <svg width="28" height="40" viewBox="0 0 28 40" fill="none">
          <path d="M14 2v32M6 26l8 8 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="ad-fallback-split">
        <div className="ad-fallback-node ad-fallback-direct">
          <span className="ad-fallback-node-label">نجح مباشرة</span>
          <strong>{formatValue(primaryDirect)}</strong>
        </div>
        <div className="ad-fallback-node ad-fallback-served">
          <span className="ad-fallback-node-label">فشل → مسار بديل</span>
          <strong>{formatValue(fallbackServed)}</strong>
          <span className="ad-fallback-node-sub">{ai.fallbackRate.value?.toFixed(1) ?? '0.0'}٪ من الطلبات</span>
        </div>
      </div>
    </div>
  )
}
