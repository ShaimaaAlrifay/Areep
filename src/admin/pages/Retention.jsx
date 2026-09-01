import { KpiCard } from '../components/KpiCard'
import { CohortHeatmap } from '../components/charts'
import { EmptyState } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'

/* The second-project rate is the one to watch. Areeb produces a document
   and the job is done — so a user coming back is not habit, it is a new
   piece of work they chose to bring here. That makes it a better read on
   real value than a daily-active count ever would be for this product. */
export function Retention() {
  const { metrics, loading, error, refresh } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="الاحتفاظ" en="Retention" purpose="هل يرجعون؟ وهل يرجعون بمشروع ثاني — وهذا الأهم في منتج زي أريب.">
        <div className="ad-kpi-grid">
          <KpiCard label="العودة بعد يوم" en="D1" kind="percent" metric={metrics?.d1} loading={loading} />
          <KpiCard label="العودة بعد 7 أيام" en="D7" kind="percent" metric={metrics?.d7} loading={loading} />
          <KpiCard label="العودة بعد 30 يوم" en="D30" kind="percent" metric={metrics?.d30} loading={loading} />
          <KpiCard label="نسبة المشروع الثاني" en="2nd Project Rate" kind="percent" metric={metrics?.secondProjectRate} loading={loading} />
        </div>

        <Panel
          title="أفواج التسجيل"
          hint="الخانات الفارغة يعني الفترة ما اكتملت لهذا الفوج بعد — مو إن أحد ما رجع."
          wide
        >
          {loading ? (
            <div className="ad-panel-loading" />
          ) : metrics?.cohorts?.length ? (
            <CohortHeatmap cohorts={metrics.cohorts} />
          ) : (
            <EmptyState hint="ما فيه أفواج مكتملة في هذي الفترة." />
          )}
        </Panel>
      </Section>
    </DataGate>
  )
}
