import { KpiCard } from '../components/KpiCard'
import { TrendChart } from '../components/charts'
import { EmptyState, NotTracked } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'

/* The thinnest section in the console, honestly so.

   Signups are real — they come from auth.users. Everything upstream of
   the signup (visitors, sources, campaigns, signup rate) needs a web
   analytics provider the product does not have wired up, so this page
   shows one real number and names the four it cannot compute. That is
   more useful than a full-looking page of plausible fictions. */
export function Acquisition() {
  const { metrics, loading, error, refresh } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section
        title="الاستحواذ"
        en="Acquisition"
        purpose="من وين يجون المستخدمون، وكم واحد منهم يسجّل فعلًا."
      >
        <div className="ad-kpi-grid">
          <KpiCard label="تسجيلات جديدة" en="New Signups" metric={metrics?.signups} loading={loading} />
          <KpiCard label="الزوّار" en="Visitors" metric={metrics?.visitors} loading={loading} />
          <KpiCard label="معدل التسجيل" en="Signup Rate" kind="percent" metric={metrics?.signupRate} loading={loading} />
        </div>

        <Panel title="التسجيلات عبر الوقت" wide>
          {loading ? (
            <div className="ad-panel-loading" />
          ) : metrics?.signups?.trend?.length > 1 ? (
            <TrendChart
              series={metrics.signups.trend.map((v) => ({ signups: v }))}
              keys={[{ key: 'signups', label: 'تسجيلات' }]}
            />
          ) : (
            <EmptyState />
          )}
        </Panel>

        <Panel title="مصادر الزيارات" hint="من وين وصلوا للموقع.">
          <NotTracked reason={metrics?.trafficSources?.reason} note="لتفعيله: اربط مزوّد تحليلات وأرسل أحداث الزيارة إليه." />
        </Panel>
      </Section>
    </DataGate>
  )
}
