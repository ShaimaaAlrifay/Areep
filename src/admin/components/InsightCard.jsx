import { Link } from 'react-router-dom'
import { formatChange } from '../analytics/metric'

/* ============================================================
   "What needs your attention."

   Four lines, in this order and no other: the metric, how it moved, a
   possible reason, and the next thing to look at. That ordering is the
   whole point of the panel — an owner should be able to read the first
   two lines and stop, or read all four and act.

   The reason line is always hedged. The dashboard sees a number move; it
   does not see why, and writing "بسبب…" would dress a correlation up as a
   diagnosis. The suggested action is where the certainty lives instead,
   because "go look at X" is something we can actually stand behind.
   ============================================================ */
export function InsightCard({ insight }) {
  return (
    <article className={`ad-insight ad-insight-${insight.level}`}>
      <header className="ad-insight-head">
        <h3>{insight.title}</h3>
        {insight.change !== null && insight.change !== undefined && (
          <span className="ad-insight-change">{formatChange(insight.change)}</span>
        )}
      </header>
      <p className="ad-insight-metric">{insight.en}</p>
      <p className="ad-insight-reason">{insight.reason}</p>
      <Link to={insight.to} className="ad-insight-action">
        {insight.action}
        <span aria-hidden="true">←</span>
      </Link>
    </article>
  )
}
