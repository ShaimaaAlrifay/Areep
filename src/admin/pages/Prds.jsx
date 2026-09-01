import { KpiCard } from '../components/KpiCard'
import { TrendChart } from '../components/charts'
import { EmptyState, NotTracked } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'

/* The document is the product's output, so this is the closest thing
   Areeb has to a units-shipped number. */
export function Prds() {
  const { metrics, loading, error, refresh } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="الوثائق" en="PRDs" purpose="المخرَج النهائي — كم وثيقة طلعت، وكم أخذت من الوقت.">
        <div className="ad-kpi-grid">
          <KpiCard label="وثائق مولَّدة" en="Generated" metric={metrics?.prdsGenerated} loading={loading} />
          <KpiCard label="الوقت حتى الوثيقة" en="Time to PRD" kind="duration" metric={metrics?.timeToPrd} loading={loading} />
          <KpiCard label="متطلبات مستخرَجة" en="Requirements" metric={metrics?.requirementsGenerated} loading={loading} />
        </div>

        <Panel title="التوليد عبر الوقت" wide>
          {loading ? (
            <div className="ad-panel-loading" />
          ) : metrics?.prdsGenerated?.trend?.length > 1 ? (
            <TrendChart
              series={metrics.prdsGenerated.trend.map((v) => ({ prds: v }))}
              keys={[{ key: 'prds', label: 'وثائق' }]}
            />
          ) : (
            <EmptyState />
          )}
        </Panel>

        <div className="ad-grid-2">
          <Panel title="نجاح التصدير" hint="PDF و Markdown.">
            <NotTracked reason="التصدير يتم داخل المتصفح ولا يُرسل أي إشارة للخادم، فما فيه نجاح أو فشل مسجّل." />
          </Panel>
          <Panel title="إعادة التوليد">
            <NotTracked reason={metrics?.regenerationRate?.reason} />
          </Panel>
        </div>
      </Section>
    </DataGate>
  )
}
