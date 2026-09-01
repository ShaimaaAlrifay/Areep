import { KpiCard } from '../components/KpiCard'
import { Funnel } from '../components/charts'
import { EmptyState } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'

/* Activation is the product's real question: a signup means nothing, a
   generated document means everything. The funnel is the whole page
   because the number that matters is not "how many activated" but "at
   which step do they stop". */
export function Activation() {
  const { metrics, loading, error, refresh } = useAdminData()

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

        <Panel title="مسار التفعيل" hint="كل خطوة تعرض النسبة من البداية والنسبة من الخطوة اللي قبلها — الثانية هي اللي تحدد وين المشكلة." wide>
          {loading ? <div className="ad-panel-loading" /> : metrics?.funnel?.length ? <Funnel steps={metrics.funnel} /> : <EmptyState />}
        </Panel>
      </Section>
    </DataGate>
  )
}
