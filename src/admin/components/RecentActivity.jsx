import { formatRelativeDate } from '../../lib/constants'
import { EmptyState } from './states'

/* ============================================================
   A pulse, not a log.

   Every row is `{ kind, at }` — that's the entire vocabulary the SQL
   function is willing to hand back, and this component doesn't stretch
   it. No id ever reaches here to link out from, and there is deliberately
   nothing to click: a feed you can click through is a browsable record,
   which is exactly what the privacy boundary elsewhere in this console
   was built to avoid becoming.
   ============================================================ */

const EVENT = {
  signup: { label: 'تسجيل جديد', dot: 'signup' },
  project: { label: 'مشروع جديد', dot: 'project' },
  prd: { label: 'وثيقة تم توليدها', dot: 'prd' },
  fallback: { label: 'مسار بديل اشتغل', dot: 'fallback' },
}

export function RecentActivity({ events = [], loading }) {
  if (loading) {
    return (
      <ul className="ad-activity">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="ad-activity-row">
            <span className="ad-skeleton" style={{ width: 130, height: 13, borderRadius: 4 }} />
            <span className="ad-skeleton" style={{ width: 60, height: 11, borderRadius: 4 }} />
          </li>
        ))}
      </ul>
    )
  }

  if (!events.length) {
    return <EmptyState title="ما فيه نشاط في هذي الفترة" />
  }

  return (
    <ul className="ad-activity">
      {events.map((e, i) => {
        const meta = EVENT[e.kind] ?? { label: e.kind, dot: 'default' }
        return (
          <li key={`${e.at}-${i}`} className="ad-activity-row">
            <span className={`ad-activity-dot is-${meta.dot}`} aria-hidden="true" />
            <span className="ad-activity-label">{meta.label}</span>
            <span className="ad-activity-time">{formatRelativeDate(e.at)}</span>
          </li>
        )
      })}
    </ul>
  )
}
