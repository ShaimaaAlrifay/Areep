import { KpiCard } from '../components/KpiCard'
import { BarList } from '../components/charts'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { PROJECT_TYPE_LABELS } from '../../lib/constants'

/* What people actually build with Areeb. This is the section that says
   where the product should get better next: if 60٪ of projects are mobile
   apps, the discovery prompt for mobile apps is the highest-leverage
   thing in the codebase. */
export function Projects() {
  const { metrics, loading, error, refresh } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="المشاريع" en="Projects" purpose="وش يبني الناس — القسم اللي يحدد وين تحسّن المنتج بعدين.">
        <div className="ad-kpi-grid">
          <KpiCard label="إجمالي المشاريع" en="Total Projects" metric={metrics?.totalProjects} loading={loading} />
          <KpiCard label="مشاريع في الفترة" en="Created" metric={metrics?.projectsCreated} loading={loading} />
          <KpiCard label="رسائل لكل مشروع" en="Messages / Project" kind="decimal" metric={metrics?.messagesPerProject} loading={loading} />
        </div>

        <Panel title="حسب النوع" wide>
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
      </Section>
    </DataGate>
  )
}
