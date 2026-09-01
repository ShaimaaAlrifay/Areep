/* ============================================================
   Data states (§25).

   Four states, four different screens. The one that matters most is
   NotTracked: it is not an error and not an empty result, it is the
   dashboard admitting the product does not measure this yet — and it
   always says what is missing, so the owner knows what to build rather
   than wondering why a box is blank.

   Zero and No-Data are deliberately not interchangeable. "0 مستخدم" is a
   finding. A blank is not. Rendering the second as the first is the
   single easiest way to make an owner act on something that never
   happened.
   ============================================================ */

export function Skeleton({ height = 20, width = '100%', radius = 6 }) {
  return <span className="ad-skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />
}

export function NotTracked({ reason, note, compact = false }) {
  return (
    <div className={`ad-nodata${compact ? ' is-compact' : ''}`}>
      <span className="ad-nodata-badge">غير مُتتبَّع</span>
      <p className="ad-nodata-reason">{reason}</p>
      {note && <p className="ad-nodata-note">{note}</p>}
    </div>
  )
}

export function EmptyState({ title = 'ما فيه بيانات في هذي الفترة', hint }) {
  return (
    <div className="ad-empty">
      <p className="ad-empty-title">{title}</p>
      {hint && <p className="ad-empty-hint">{hint}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="ad-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="ad-btn ad-btn-ghost" onClick={onRetry}>
          حاول مرة ثانية
        </button>
      )}
    </div>
  )
}

const STATUS_LABEL = {
  healthy: 'سليم',
  warning: 'يحتاج انتباه',
  critical: 'حرج',
  unknown: 'غير معروف',
}

/* `unknown` is styled as neutral-grey, never green. An unmeasured
   subsystem shown as healthy is a false all-clear. */
export function StatusPill({ status }) {
  return (
    <span className={`ad-pill ad-pill-${status}`}>
      <i aria-hidden="true" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
