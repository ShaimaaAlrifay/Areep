import { useEffect, useState } from 'react'
import { KpiCard } from '../components/KpiCard'
import { BarList } from '../components/charts'
import { FallbackDiagram } from '../components/FallbackDiagram'
import { EmptyState, NotTracked, StatusPill } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { formatValue, metric } from '../analytics/metric'
import { formatRelativeDate } from '../../lib/constants'
import { fetchAiLimits } from '../settings/client'

/* Same tier the provider table below judges each row by — reused rather
   than re-guessed, so the headline status and the per-provider pills in
   the table can never contradict each other. */
function aiHealthTier(errorRate) {
  if (errorRate === null) return null
  if (errorRate >= 20) return 'critical'
  if (errorRate >= 5) return 'warning'
  return 'healthy'
}

const TIER_LABEL = { healthy: 'مستقر', warning: 'يحتاج مراجعة', critical: 'حرج' }

/* Current-state counts, not date-ranged like the rest of this page — "how
   many users are near their limit right now" doesn't have a "this week
   vs last week" framing. Reuses admin_get_ai_limits() (already computed
   for the Settings panel) rather than growing admin_analytics() to
   duplicate the same numbers. No ids, no emails — same rule as
   everywhere else on this page: aggregate counts only. */
function AiQuotaHealthPanel() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchAiLimits().then(({ data }) => {
      if (!mounted) return
      setLoading(false)
      if (data) setStatus(data)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="ad-kpi-grid">
        <KpiCard label="ضمن الحد" en="Healthy" loading />
        <KpiCard label="قريبون من الحد" en="Near Limit" loading />
        <KpiCard label="تجاوزوا الحد" en="Over Limit" loading />
      </div>
    )
  }

  if (!status) {
    return <NotTracked reason="ما قدرنا نجيب حالة الحصص — تأكد إن دالة admin-settings منشورة." />
  }

  return (
    <div className="ad-kpi-grid">
      <KpiCard label="ضمن الحد بارتياح" en="Healthy" metric={metric({ value: status.usage.healthy })} />
      <KpiCard label="قريبون من الحد" en="Near Limit (80%+)" metric={metric({ value: status.usage.nearLimit })} />
      <KpiCard label="تجاوزوا الحد" en="Over Limit" metric={metric({ value: status.usage.overLimit })} />
    </div>
  )
}

/* ============================================================
   The engine room: every model call the product makes, as it actually
   happened — which provider answered, on which attempt, how long it took,
   and whether it worked.

   Fallback deserves its own number rather than hiding inside the success
   rate. A run where the primary provider failed and the backup saved it
   is a success for the user and a warning for the owner, and one metric
   cannot say both.
   ============================================================ */
export function AiOperations() {
  const { metrics, loading, error, refresh } = useAdminData()
  const ai = metrics?.ai
  const tier = ai?.available ? aiHealthTier(ai.errorRate.value) : null

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="عمليات الذكاء الاصطناعي" en="AI Operations" purpose="صحة المزوّدين، نسبة الفشل، والمسار البديل.">
        <Panel title="حالة الحصص" hint="كم مستخدم قريب من حده الشهري أو تجاوزه — أعداد فقط، بدون تعريف بالمستخدمين.">
          <AiQuotaHealthPanel />
        </Panel>

        {!loading && ai?.available && tier && (
          <div className={`ad-ai-health is-${tier}`}>
            <span className="ad-ai-health-label">AI Health</span>
            <span className={`ad-ai-health-pill is-${tier}`}>
              <i aria-hidden="true" />
              {TIER_LABEL[tier]}
            </span>
          </div>
        )}

        {!loading && ai && !ai.available ? (
          <Panel>
            <NotTracked
              reason={ai.reason}
              note="التتبّع مضاف في الدوال — أول استدعاء اكتشاف أو توليد بيبدأ يعبّي هذي الصفحة."
            />
          </Panel>
        ) : (
          <>
            <div className="ad-kpi-grid">
              <KpiCard label="عدد الاستدعاءات" en="Total Requests" metric={ai?.requests} loading={loading} />
              <KpiCard label="نسبة النجاح" en="Success Rate" kind="percent" metric={ai?.successRate} loading={loading} />
              <KpiCard label="نسبة الفشل" en="Error Rate" kind="percent" metric={ai?.errorRate} loading={loading} />
              <KpiCard label="نسبة المسار البديل" en="Fallback Rate" kind="percent" metric={ai?.fallbackRate} loading={loading} />
              <KpiCard label="إجمالي التوكينز" en="Total Tokens" metric={ai?.totalTokens} loading={loading} />
              <KpiCard label="تكلفة الوثيقة" en="Cost / PRD" kind="money" metric={ai?.costPerPrd} loading={loading} />
            </div>

            <Panel title="المسار الأساسي والبديل" hint="من يخدم الطلب أولًا، ومتى يتدخّل المسار البديل.">
              <FallbackDiagram ai={ai} />
            </Panel>

            <div className="ad-grid-2">
              <Panel title="حسب المزوّد" hint="نسبة النجاح ومتوسط زمن الاستجابة لكل مزوّد.">
                {loading ? (
                  <div className="ad-panel-loading" />
                ) : ai?.byProvider?.length ? (
                  <div className="ad-table-scroll">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th scope="col">المزوّد</th>
                          <th scope="col">استدعاءات</th>
                          <th scope="col">نجاح</th>
                          <th scope="col">متوسط الزمن</th>
                          <th scope="col">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ai.byProvider.map((p) => {
                          const rate = p.requests ? (p.ok / p.requests) * 100 : 0
                          return (
                            <tr key={p.provider}>
                              <th scope="row">{p.provider}</th>
                              <td>{formatValue(p.requests)}</td>
                              <td>{rate.toFixed(1)}٪</td>
                              <td>{p.avgDurationMs === null ? '—' : `${(p.avgDurationMs / 1000).toFixed(1)}ث`}</td>
                              <td>
                                <StatusPill status={rate >= 95 ? 'healthy' : rate >= 80 ? 'warning' : 'critical'} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState />
                )}
              </Panel>

              <Panel title="حسب نوع الاستدعاء">
                {loading ? (
                  <div className="ad-panel-loading" />
                ) : (
                  <BarList
                    items={(ai?.byKind ?? []).map((k) => ({
                      key: k.kind,
                      label: k.kind === 'discovery' ? 'جلسة الاكتشاف' : 'توليد الوثيقة',
                      value: k.requests,
                    }))}
                  />
                )}
              </Panel>
            </div>

            <div className="ad-grid-2">
              <Panel title="استهلاك التوكينز">
                <div className="ad-stat-row">
                  <KpiCard label="مدخلات" en="Input Tokens" metric={ai?.inputTokens} loading={loading} />
                  <KpiCard label="مخرجات" en="Output Tokens" metric={ai?.outputTokens} loading={loading} />
                </div>
              </Panel>

              {/* Error text only, never the prompt or the user's content —
                  the point is to recognise the failure, not to read the
                  session it came from. */}
              <Panel title="آخر حالات الفشل" hint="نص الخطأ فقط — بدون أي محتوى من جلسة المستخدم.">
                {loading ? (
                  <div className="ad-panel-loading" />
                ) : ai?.recentFailures?.length ? (
                  <ul className="ad-events">
                    {ai.recentFailures.map((f, i) => (
                      <li key={`${f.at}-${i}`}>
                        <span className="ad-event-provider">{f.provider}</span>
                        <span className="ad-event-msg" title={f.error}>
                          {f.error}
                        </span>
                        <span className="ad-event-time">{formatRelativeDate(f.at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="ما فيه فشل مسجّل في هذي الفترة" />
                )}
              </Panel>
            </div>
          </>
        )}
      </Section>
    </DataGate>
  )
}
