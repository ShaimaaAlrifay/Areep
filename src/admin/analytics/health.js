/* ============================================================
   "How is Areeb doing right now?" — one status, and only when the data
   can actually support one.

   This is deliberately the strictest logic in the console. A status is
   assessable only from signals that have something to compare against:
   a metric with a real previous-period value, or a rate whose absolute
   level a fixed threshold can judge (an error rate means something on
   its own; a raw count without a comparison does not). Below a minimum
   number of those signals, the answer is "not enough data" — never a
   guess dressed as an assessment.

   The severity itself is borrowed from buildInsights() rather than
   re-derived: that function already decides what counts as critical or
   worth a warning, and duplicating the thresholds here would be the
   first place the two silently drift apart.
   ============================================================ */

const MIN_ASSESSABLE_SIGNALS = 2

function isAssessable(mt) {
  return Boolean(mt?.available) && mt.change !== null
}

export function buildProductHealth(metrics, insights) {
  if (!metrics) return { status: 'insufficient', summary: null }

  const comparable = [metrics.signups, metrics.projectsCreated, metrics.prdsGenerated, metrics.activationRate, metrics.d7]
  let assessable = comparable.filter(isAssessable).length

  // An error rate judges itself against a fixed bar even with no prior
  // period to diff against — a sample is still required, or "3 requests,
  // 0 failed" would count as a clean read.
  const aiAssessable = metrics.ai?.available && (metrics.ai.errorRate.sampleSize ?? 0) > 0
  if (aiAssessable) assessable += 1

  if (assessable < MIN_ASSESSABLE_SIGNALS) {
    return { status: 'insufficient', summary: 'البيانات الحالية غير كافية لتقييم حالة المنتج.' }
  }

  const critical = insights.find((i) => i.level === 'critical')
  const warning = insights.find((i) => i.level === 'warning')

  const growthUp = metrics.signups.change !== null && metrics.signups.change > 0
  const growthDown = metrics.signups.change !== null && metrics.signups.change < 0
  const growthClause = growthUp
    ? 'النمو جيد'
    : growthDown
      ? 'النمو تباطأ'
      : 'النمو مستقر'

  if (critical) {
    return {
      status: 'critical',
      summary: `${growthClause}، لكن هناك ما يحتاج تدخّلًا الآن: ${critical.title} — ${critical.reason}`,
    }
  }
  if (warning) {
    return {
      status: 'watch',
      summary: `${growthClause}، لكن ${warning.title} يحتاج مراجعة — ${warning.reason}`,
    }
  }
  return {
    status: 'healthy',
    summary: growthUp
      ? 'النمو جيد وما فيه مؤشر يحتاج تدخّلًا عاجلًا هذي الفترة.'
      : 'ما فيه مؤشر يحتاج تدخّلًا عاجلًا هذي الفترة.',
  }
}
