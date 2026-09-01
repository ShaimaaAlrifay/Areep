import { KpiCard } from '../components/KpiCard'
import { Funnel, TrendChart } from '../components/charts'
import { EmptyState } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'

/* Activation is the product's real question: a signup means nothing, a
   generated document means everything. The funnel is the core of the
   page because the number that matters is not "how many activated" but
   "at which step do they stop". */
export function Activation() {
  const { metrics, loading, error, refresh } = useAdminData()

  // Empty-cohort days (no signups that day) have no rate to plot — a null,
  // not a zero — so they're dropped rather than charted as "0% converted".
  const trend = (metrics?.activationDaily ?? []).filter((d) => d.cohortSize > 0 && d.rate !== null)
  const droppedDays = (metrics?.activationDaily?.length ?? 0) - trend.length

  return (
    <DataGate error={error} refresh={refresh}>
      <Section
        title="التفعيل"
        en="Activation"
        purpose="كم واحد وصل لأول قيمة حقيقية — وثيقة مولَّدة — وكم واحد وقف بالطريق."
      >
        <div className="ad-kpi-grid">
          <KpiCard label="معدل التفعيل" en="Activation Rate" kind="percent" metric={metrics?.activationRate} loading={loading} />
          <KpiCard label="مشاريع أُنشئت" en="Projects Created" metric={metrics?.projectsCreated} loading={loading} />
          <KpiCard label="وثائق مولَّدة" en="PRDs Generated" metric={metrics?.prdsGenerated} loading={loading} />
          <KpiCard label="الوقت حتى أول وثيقة" en="Time to First PRD" kind="duration" metric={metrics?.timeToPrd} loading={loading} />
        </div>

        <Panel
          title="مسار التفعيل"
          hint="كل خطوة تعرض النسبة من البداية والنسبة من الخطوة اللي قبلها — الثانية هي اللي تحدد وين المشكلة."
          wide
        >
          {loading ? <div className="ad-panel-loading" /> : metrics?.funnel?.length ? <Funnel steps={metrics.funnel} /> : <EmptyState />}
          <p className="ad-definition">
            <strong>تعريف التفعيل:</strong> يُعتبر المستخدم مفعّلًا (Activated) عندما يصل أحد مشاريعه إلى توليد وثيقة
            PRD — بغض النظر متى صار ذلك بعد التسجيل. نفس التعريف المستخدم في مرحلة «ولّد وثيقة» أعلاه، وفي بطاقة
            معدل التفعيل.
          </p>
        </Panel>

        <Panel
          title="اتجاه التفعيل"
          hint="نسبة كل فوج تسجيل يوميّ وصلت لتوليد وثيقة حتى الآن. الأيام بدون تسجيلات غير معروضة، والأفواج الأحدث كان أمامها وقت أقل للتحول."
          wide
        >
          {loading ? (
            <div className="ad-panel-loading" />
          ) : trend.length > 1 ? (
            <>
              <TrendChart
                series={trend.map((d) => ({ rate: d.rate }))}
                keys={[{ key: 'rate', label: 'نسبة التفعيل (٪ من فوج اليوم)' }]}
              />
              {droppedDays > 0 && <p className="ad-chart-note">{droppedDays} يوم بدون تسجيلات غير معروض.</p>}
            </>
          ) : (
            <EmptyState hint="تحتاج يومين على الأقل فيهما تسجيلات عشان يظهر الخط." />
          )}
        </Panel>
      </Section>
    </DataGate>
  )
}
