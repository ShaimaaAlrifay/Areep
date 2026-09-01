import { KpiCard } from '../components/KpiCard'
import { InsightCard } from '../components/InsightCard'
import { Funnel, TrendChart, BarList } from '../components/charts'
import { EmptyState, NotTracked } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { PROJECT_TYPE_LABELS } from '../../lib/constants'

/* ============================================================
   The first screen, and the one that has to earn its place.

   Order is the design here. "What needs your attention" sits above the
   KPI row on purpose: an owner opening this at 9am wants to know whether
   anything moved, and only then what the numbers are. A grid of cards at
   the top would make them do the diffing themselves, every morning.

   Six KPIs, not sixteen. Each one is a link to the section that explains
   it, so the overview stays a summary instead of slowly absorbing every
   chart in the console.
   ============================================================ */
export function Overview() {
  const { metrics, loading, error, insights, refresh, range } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section
        title="نظرة عامة"
        en="Overview"
        purpose={`حالة المنتج خلال ${range?.preset?.label ?? '—'} — وش تغيّر، ووين يحتاج انتباهك.`}
      >
        <Panel title="محتاج انتباهك" hint="مبني على المؤشرات المتاحة فقط — الأسباب اجتهاد، مو تشخيص مؤكد.">
          {loading ? (
            <div className="ad-insight-grid">
              <div className="ad-insight is-loading" />
              <div className="ad-insight is-loading" />
            </div>
          ) : insights.length === 0 ? (
            <EmptyState
              title="ما فيه شيء يحتاج انتباهك الحين"
              hint="ما تجاوز أي مؤشر متابَع حدوده في هذي الفترة."
            />
          ) : (
            <div className="ad-insight-grid">
              {insights.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          )}
        </Panel>

        <div className="ad-kpi-grid">
          <KpiCard label="تسجيلات جديدة" en="Signups" metric={metrics?.signups} loading={loading} to="/admin/acquisition" />
          <KpiCard label="مشاريع أُنشئت" en="Projects Created" metric={metrics?.projectsCreated} loading={loading} to="/admin/activation" />
          <KpiCard label="وثائق مولَّدة" en="PRDs Generated" metric={metrics?.prdsGenerated} loading={loading} to="/admin/prds" />
          <KpiCard label="معدل التفعيل" en="Activation Rate" kind="percent" metric={metrics?.activationRate} loading={loading} to="/admin/activation" />
          <KpiCard label="العودة بعد 7 أيام" en="D7 Retention" kind="percent" metric={metrics?.d7} loading={loading} to="/admin/retention" />
          <KpiCard label="أخطاء الذكاء الاصطناعي" en="AI Error Rate" kind="percent" metric={metrics?.ai?.errorRate} loading={loading} to="/admin/ai" />
        </div>

        <div className="ad-grid-2">
          <Panel title="مسار المستخدم" hint="من التسجيل إلى وثيقة مكتملة.">
            {loading ? <div className="ad-panel-loading" /> : metrics?.funnel?.length ? <Funnel steps={metrics.funnel} /> : <EmptyState />}
          </Panel>

          <Panel title="أكثر أنواع المشاريع" hint="وش يبني الناس فعلًا بأريب.">
            {loading ? (
              <div className="ad-panel-loading" />
            ) : (
              <BarList
                items={(metrics?.projectTypes ?? []).map((t) => ({
                  key: t.type,
                  label: PROJECT_TYPE_LABELS[t.type] ?? t.type,
                  value: t.count,
                }))}
              />
            )}
          </Panel>
        </div>

        <Panel title="النشاط اليومي" wide>
          {loading ? (
            <div className="ad-panel-loading" />
          ) : metrics?.signups?.trend?.length > 1 ? (
            <TrendChart
              series={buildSeries(metrics)}
              keys={[
                { key: 'signups', label: 'تسجيلات' },
                { key: 'projects', label: 'مشاريع' },
                { key: 'prds', label: 'وثائق' },
              ]}
            />
          ) : (
            <EmptyState hint="تحتاج يومين على الأقل من البيانات عشان يظهر الخط." />
          )}
        </Panel>

        <Panel title="الزوّار ومصادر الزيارات">
          <NotTracked reason={metrics?.visitors?.reason} />
        </Panel>
      </Section>
    </DataGate>
  )
}

function buildSeries(metrics) {
  const s = metrics.signups.trend
  const p = metrics.projectsCreated.trend
  const d = metrics.prdsGenerated.trend
  return s.map((v, i) => ({ signups: v, projects: p[i] ?? 0, prds: d[i] ?? 0 }))
}
