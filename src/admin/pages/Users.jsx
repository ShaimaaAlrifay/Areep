import { KpiCard } from '../components/KpiCard'
import { Funnel } from '../components/charts'
import { EmptyState } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { UserUsageLookup } from '../components/UserUsageLookup'

/* ============================================================
   Users in aggregate — and deliberately not a user list.

   The console never receives an email, a name, or a project title: the
   analytics function returns counts and rates only. That is a privacy
   boundary, not a missing feature. An owner needs to know that 40٪ stop
   after the first message; they do not need to know which person did.

   If a per-user view is ever genuinely needed (a support ticket, an abuse
   report), it should be a separate, logged lookup by id — not a browsable
   table sitting open in a dashboard tab all day.
   ============================================================ */
export function Users() {
  const { metrics, loading, error, refresh } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="المستخدمون" en="Users" purpose="سلوك المستخدمين كمجموعة — بدون أي بيانات شخصية.">
        <div className="ad-kpi-grid">
          <KpiCard label="تسجيلات جديدة" en="New Signups" metric={metrics?.signups} loading={loading} />
          <KpiCard label="مشاريع لكل مستخدم" en="Projects / User" kind="decimal" metric={metrics?.projectsPerUser} loading={loading} />
          <KpiCard label="معدل التفعيل" en="Activation Rate" kind="percent" metric={metrics?.activationRate} loading={loading} />
          <KpiCard label="نسبة المشروع الثاني" en="2nd Project Rate" kind="percent" metric={metrics?.secondProjectRate} loading={loading} />
        </div>

        <Panel title="وين يتوقفون" wide>
          {loading ? <div className="ad-panel-loading" /> : metrics?.funnel?.length ? <Funnel steps={metrics.funnel} /> : <EmptyState />}
        </Panel>

        {/* Deliberately not a browsable list — the analytics function
            above never returns anything identifying, on purpose (see its
            own docstring). This is the "separate, logged lookup by id"
            escape hatch for the rare real need: a support question, an
            abuse report, or setting one person's AI usage override. */}
        <Panel title="بحث عن مستخدم" hint="بالبريد الإلكتروني أو المعرّف — بحث فردي، مو قائمة قابلة للتصفح.">
          <UserUsageLookup />
        </Panel>
      </Section>
    </DataGate>
  )
}
