import { KpiCard } from '../components/KpiCard'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { NotTracked } from '../components/states'

export function Engagement() {
  const { metrics, loading, error, refresh } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="التفاعل" en="Engagement" purpose="عمق الاستخدام: كم يشتغل المستخدم داخل الجلسة، وكم مشروع يبني.">
        <div className="ad-kpi-grid">
          <KpiCard label="رسائل لكل مشروع" en="Messages / Project" kind="decimal" metric={metrics?.messagesPerProject} loading={loading} />
          <KpiCard label="مشاريع لكل مستخدم" en="Projects / User" kind="decimal" metric={metrics?.projectsPerUser} loading={loading} />
          <KpiCard label="الوقت حتى الوثيقة" en="Time to PRD" kind="duration" metric={metrics?.timeToPrd} loading={loading} />
        </div>

        {/* Session length needs a client-side session concept the product
            does not have. Estimating it from message timestamps would be a
            guess dressed as a measurement. */}
        <Panel title="طول الجلسة" hint="متوسط المدة من أول رسالة إلى آخر رسالة.">
          <NotTracked reason="ما فيه تتبّع جلسات في الواجهة — أي رقم هنا بيكون تقديرًا من طوابع الرسائل، مو قياسًا." />
        </Panel>
      </Section>
    </DataGate>
  )
}
