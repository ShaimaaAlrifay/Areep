import { KpiCard } from '../components/KpiCard'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'

/* ============================================================
   Revenue, with nothing in it — on purpose.

   Areeb has no billing: no plans, no subscriptions, no payments table.
   So MRR, ARPU, trial-to-paid and churn are not "zero this month", they
   are undefined, and the four cards say exactly that.

   The section exists rather than being hidden because the gap is itself
   information the owner needs, and because when billing does ship, the
   only change here is that the selectors in analytics/client.js start
   returning real metrics — the page does not move.

   No demo numbers, not even behind a development flag. A screenshot
   outlives the flag that produced it, and "$4,280 MRR" in a deck is a
   claim about a product that has never charged anyone.
   ============================================================ */
export function Revenue() {
  const { metrics, loading, error, refresh } = useAdminData()

  return (
    <DataGate error={error} refresh={refresh}>
      <Section title="الإيراد" en="Revenue" purpose="أريب مجاني بالكامل حاليًا — ما فيه نظام فوترة، فما فيه إيراد يُقاس.">
        <div className="ad-kpi-grid">
          <KpiCard label="الإيراد الشهري المتكرر" en="MRR" kind="money" metric={metrics?.mrr} loading={loading} />
          <KpiCard label="متوسط الإيراد لكل مستخدم" en="ARPU" kind="money" metric={metrics?.arpu} loading={loading} />
          <KpiCard label="التحويل من تجريبي إلى مدفوع" en="Trial → Paid" kind="percent" metric={metrics?.trialToPaid} loading={loading} />
          <KpiCard label="معدل الإلغاء" en="Churn" kind="percent" metric={metrics?.churn} loading={loading} />
        </div>

        <Panel title="وش يلزم لتفعيل هذا القسم">
          <ol className="ad-checklist">
            <li>جداول للخطط والاشتراكات والمدفوعات في قاعدة البيانات.</li>
            <li>ربط مزوّد دفع وتسجيل أحداثه (اشتراك، تجديد، إلغاء).</li>
            <li>إضافة الحسابات إلى دالة <code>admin_analytics</code> ورجوعها ضمن مفتاح <code>revenue</code>.</li>
          </ol>
          <p className="ad-note">
            بعدها تشتغل هذي البطاقات نفسها بدون أي تغيير في الواجهة — تحديث في طبقة التحليلات فقط.
          </p>
        </Panel>
      </Section>
    </DataGate>
  )
}
