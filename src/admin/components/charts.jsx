/* ============================================================
   Charts, hand-rolled in SVG.

   No charting library: the whole vocabulary here is four shapes, and a
   library would cost more bytes than the dashboard's entire JavaScript
   while making RTL somebody else's default. Every chart below is drawn
   right-to-left because that is the reading direction of this product,
   not flipped after the fact.

   None of these accept a "make something up" path — a series with no
   points renders nothing rather than a decorative wave. Random charts
   were explicitly out of scope, and the easiest way to keep them out is
   for the components to be incapable of producing one.
   ============================================================ */
import { formatValue } from '../analytics/metric'
import { EmptyState } from './states'

/** Trend line for a KPI card. Latest point is on the LEFT (RTL time flow). */
export function Sparkline({ data = [], width = 120, height = 32, tone = 'neutral' }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const step = width / (data.length - 1)

  // Reversed x: index 0 (oldest) sits at the right edge.
  const points = data.map((v, i) => {
    const x = width - i * step
    const y = height - ((v - min) / span) * (height - 4) - 2
    return [x, y]
  })

  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${d} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`

  return (
    <svg className={`ad-spark ad-spark-${tone}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path className="ad-spark-area" d={area} />
      <path className="ad-spark-line" d={d} />
    </svg>
  )
}

/** Daily series with a comparison-free single line, used on section pages. */
export function TrendChart({ series = [], keys = [], height = 220 }) {
  if (!series.length) return null
  const width = 720
  const pad = { top: 12, bottom: 24, side: 8 }
  const all = series.flatMap((d) => keys.map((k) => Number(d[k.key] ?? 0)))
  const max = Math.max(1, ...all)
  const step = series.length > 1 ? (width - pad.side * 2) / (series.length - 1) : 0
  const plotH = height - pad.top - pad.bottom

  const line = (key) =>
    series
      .map((d, i) => {
        const x = width - pad.side - i * step
        const y = pad.top + plotH - (Number(d[key] ?? 0) / max) * plotH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

  return (
    <div className="ad-trend">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="السلسلة الزمنية">
        {[0, 0.5, 1].map((t) => (
          <line key={t} className="ad-grid" x1={pad.side} x2={width - pad.side} y1={pad.top + plotH * t} y2={pad.top + plotH * t} />
        ))}
        {keys.map((k, i) => (
          <path key={k.key} className={`ad-line ad-line-${i}`} d={line(k.key)} />
        ))}
      </svg>
      <div className="ad-legend">
        {keys.map((k, i) => (
          <span key={k.key} className="ad-legend-item">
            <i className={`ad-dot ad-line-${i}`} aria-hidden="true" />
            {k.label}
          </span>
        ))}
        <span className="ad-legend-scale">الأعلى: {formatValue(max)}</span>
      </div>
    </div>
  )
}

/**
 * The activation funnel.
 *
 * Each step shows both conversions: from the very first step (how much of
 * the original cohort is left) and from the step immediately before it.
 * The second is the one that localises a problem — an overall number that
 * halves tells you something is wrong, the step-over-step number tells you
 * where.
 */
export function Funnel({ steps = [] }) {
  if (!steps.length) return null
  /* Every stage at zero is a legitimate answer — nobody signed up in this
     window — and it has to be said out loud. Returning null here left the
     panel blank, which reads as a component that failed to load. */
  const first = steps[0]?.users ?? 0
  if (!first) {
    return <EmptyState title="ما فيه مستخدمين دخلوا المسار في هذي الفترة" hint="ما فيه تسجيلات، فما فيه مسار يُقاس." />
  }

  return (
    <ol className="ad-funnel">
      {steps.map((step, i) => {
        const prev = i === 0 ? null : steps[i - 1].users
        const ofFirst = (step.users / first) * 100
        const ofPrev = prev ? (step.users / prev) * 100 : null
        const dropped = prev ? prev - step.users : 0
        return (
          <li key={step.key} className="ad-funnel-step">
            <div className="ad-funnel-head">
              <span className="ad-funnel-label">{step.label}</span>
              <span className="ad-funnel-count">{formatValue(step.users)}</span>
            </div>
            <div className="ad-funnel-track">
              <div className="ad-funnel-fill" style={{ width: `${Math.max(ofFirst, 0.6)}%` }} />
            </div>
            <div className="ad-funnel-meta">
              <span>{ofFirst.toFixed(1)}٪ من البداية</span>
              {ofPrev !== null && (
                <span className={dropped > 0 ? 'is-drop' : ''}>
                  {ofPrev.toFixed(1)}٪ من الخطوة السابقة
                  {dropped > 0 && ` — تسرّب ${formatValue(dropped)}`}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Horizontal ranked bars — project types, providers, error kinds. */
export function BarList({ items = [], valueKind = 'number', emptyLabel = 'ما فيه بيانات' }) {
  if (!items.length) return <p className="ad-inline-empty">{emptyLabel}</p>
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1)
  const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0)

  return (
    <ul className="ad-bars">
      {items.map((item) => (
        <li key={item.key ?? item.label} className="ad-bar-row">
          <span className="ad-bar-label" title={item.label}>
            {item.label}
          </span>
          <span className="ad-bar-track">
            <span className="ad-bar-fill" style={{ width: `${((Number(item.value) || 0) / max) * 100}%` }} />
          </span>
          <span className="ad-bar-value">
            {formatValue(item.value, valueKind)}
            {total > 0 && valueKind === 'number' && (
              <em>{(((Number(item.value) || 0) / total) * 100).toFixed(0)}٪</em>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Retention cohorts.
 *
 * Cells are only rendered where the window has actually elapsed: a cohort
 * that signed up two days ago has no D7 number yet, and printing 0٪ there
 * would read as "nobody came back" when the truth is "it is not day seven".
 * Those cells stay blank with a title explaining why.
 */
export function CohortHeatmap({ cohorts = [] }) {
  if (!cohorts.length) return null
  const cols = [
    { key: 'd1', label: 'يوم 1' },
    { key: 'd7', label: 'يوم 7' },
    { key: 'd30', label: 'يوم 30' },
  ]
  const minAge = { d1: 1, d7: 7, d30: 30 }

  return (
    <div className="ad-table-scroll">
      <table className="ad-cohort">
        <thead>
          <tr>
            <th scope="col">الفوج</th>
            <th scope="col">الحجم</th>
            {cols.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort}>
              <th scope="row">{c.cohort}</th>
              <td>{formatValue(c.size)}</td>
              {cols.map((col) => {
                const mature = Number(c.ageDays ?? 0) >= minAge[col.key]
                if (!mature) {
                  return (
                    <td key={col.key} className="ad-cell-immature" title="الفترة ما اكتملت لهذا الفوج بعد">
                      —
                    </td>
                  )
                }
                const pct = c.size ? (Number(c[col.key] || 0) / c.size) * 100 : 0
                return (
                  <td key={col.key} className="ad-cell" style={{ '--heat': Math.min(1, pct / 60).toFixed(2) }}>
                    <span>{pct.toFixed(0)}٪</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
