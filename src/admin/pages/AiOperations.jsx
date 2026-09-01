import { KpiCard } from '../components/KpiCard'
import { BarList } from '../components/charts'
import { EmptyState, NotTracked, StatusPill } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { formatValue } from '../analytics/metric'
import { formatRelativeDate } from '../../lib/constants'

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

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="عمليات الذكاء الاصطناعي" en="AI Operations" purpose="صحة المزوّدين، نسبة الفشل، والمسار البديل.">
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
              <KpiCard label="عدد الاستدعاءات" en="Requests" metric={ai?.requests} loading={loading} />
              <KpiCard label="نسبة الفشل" en="Error Rate" kind="percent" metric={ai?.errorRate} loading={loading} />
              <KpiCard label="نسبة المسار البديل" en="Fallback Rate" kind="percent" metric={ai?.fallbackRate} loading={loading} />
              <KpiCard label="تكلفة الوثيقة" en="Cost / PRD" kind="money" metric={ai?.costPerPrd} loading={loading} />
            </div>

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
