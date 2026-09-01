import { KpiCard } from '../components/KpiCard'
import { BarList } from '../components/charts'
import { NotTracked } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'

/* ============================================================
   Quality — and the section where the temptation to invent is strongest.

   There is no accuracy score here, and there will not be one until
   something in the product actually measures it. A percentage labelled
   "دقة الوثيقة" with no ground truth behind it is not an optimistic
   estimate, it is a fabricated number that an owner would make decisions
   on.

   What IS real: how often a user edits what Areeb extracted before
   approving it. A rising edit rate is the closest honest proxy the
   product has for extraction quality — and it is presented as a proxy,
   not as accuracy.
   ============================================================ */
export function Quality() {
  const { metrics, loading, error, refresh } = useAdminData()

  const buckets = (metrics?.confidenceBuckets ?? []).map((b) => ({
    key: b.bucket,
    label: b.bucket,
    value: b.count,
  }))

  return (
    <DataGate error={error} refresh={refresh}>
      <Section
        title="الجودة"
        en="Quality"
        purpose="هل مخرجات أريب صحيحة؟ اللي نقدر نقيسه فعلًا هو كم يعدّل المستخدم قبل ما يعتمد."
      >
        <div className="ad-kpi-grid">
          <KpiCard label="متطلبات مستخرَجة" en="Requirements Generated" metric={metrics?.requirementsGenerated} loading={loading} />
          <KpiCard
            label="نسبة التعديل"
            en="Edit Rate"
            kind="percent"
            metric={metrics?.editRate}
            loading={loading}
            hint="ارتفاعها يشير لضعف في الاستخراج — مؤشر غير مباشر، مو قياس دقة."
          />
          <KpiCard label="متطلبات أضافها المستخدم" en="User-Added" metric={metrics?.requirementsUserAdded} loading={loading} />
        </div>

        <div className="ad-grid-2">
          <Panel title="توزيع ثقة الاستخراج" hint="ثقة أريب في المتطلبات اللي استخرجها.">
            <BarList items={buckets} emptyLabel="ما فيه متطلبات في هذي الفترة" />
          </Panel>

          <Panel title="تقييم المستخدمين" hint="👍 / 👎 على الوثيقة المولَّدة.">
            <NotTracked
              reason={metrics?.feedback?.reason}
              note="لتفعيله: أضف زرّي تقييم في شاشة الوثيقة واحفظ النتيجة."
            />
          </Panel>
        </div>

        <div className="ad-grid-2">
          <Panel title="دقة الوثيقة" en="PRD Accuracy">
            <NotTracked reason={metrics?.prdAccuracy?.reason} />
          </Panel>
          <Panel title="نسبة إعادة التوليد" en="Regeneration Rate">
            <NotTracked
              reason={metrics?.regenerationRate?.reason}
              note="لتفعيله: احفظ كل إصدار وثيقة بدل استبدال السابق."
            />
          </Panel>
        </div>
      </Section>
    </DataGate>
  )
}
