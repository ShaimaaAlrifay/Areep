import { useState } from 'react'
import { TrendChart } from './charts'
import { EmptyState } from './states'

/* ============================================================
   One chart, three toggles, instead of three charts.

   Signups, projects and PRDs share a Y-axis (all three are "how many
   people did a thing today"), so overlaying them as a multi-line chart
   the way the old Overview did buries the shape of any single one under
   the other two. A toggle asks the one question a growth chart exists to
   answer — "is THIS number moving?" — for whichever number the owner
   actually points it at.
   ============================================================ */

const SERIES = [
  { key: 'signups', label: 'تسجيلات', metricKey: 'signups' },
  { key: 'projects', label: 'مشاريع', metricKey: 'projectsCreated' },
  { key: 'prds', label: 'وثائق', metricKey: 'prdsGenerated' },
]

export function GrowthChart({ metrics }) {
  const [active, setActive] = useState('signups')

  const trend = metrics?.[SERIES.find((s) => s.key === active).metricKey]?.trend ?? []
  const series = trend.map((v) => ({ [active]: v }))

  return (
    <div className="ad-growth">
      <div className="ad-growth-toggle" role="group" aria-label="اختر المؤشر">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`ad-growth-toggle-btn${active === s.key ? ' is-active' : ''}`}
            onClick={() => setActive(s.key)}
            aria-pressed={active === s.key}
          >
            {s.label}
          </button>
        ))}
      </div>

      {trend.length > 1 ? (
        <TrendChart series={series} keys={[{ key: active, label: SERIES.find((s) => s.key === active).label }]} />
      ) : (
        <EmptyState hint="تحتاج يومين على الأقل من البيانات عشان يظهر الخط." />
      )}
    </div>
  )
}
