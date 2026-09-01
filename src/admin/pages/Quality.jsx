import { KpiCard } from '../components/KpiCard'
import { BarList, TrendChart } from '../components/charts'
import { EmptyState, NotTracked } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { buildFeedbackInsights } from '../analytics/insights'
import {
  EDIT_LEVEL,
  labelFor,
  NEGATIVE_REASONS,
  POSITIVE_REASONS,
  REQUIREMENT_ACCURACY,
  REQUIREMENT_COMPLETENESS,
  VALUE_RATING,
} from '../../lib/prdFeedbackOptions'

/* ============================================================
   Quality — and the section where the temptation to invent is strongest.

   There is no accuracy score here, and there will not be one until
   something in the product actually measures it. A percentage labelled
   "دقة الوثيقة" with no ground truth behind it is not an optimistic
   estimate, it is a fabricated number that an owner would make decisions
   on.

   What IS real: how often a user edits what Areeb extracted before
   approving it (System Effort, computed) — and, since the PRD feedback
   system, what users directly say about the result (Satisfaction,
   Requirement Quality, Product Value — self-reported). These are kept as
   separate signals, never folded into one "quality score": a user can
   give 5 stars and still edit 40% of the requirements, and that is not a
   contradiction to paper over (spec §24).
   ============================================================ */
export function Quality() {
  const { metrics, loading, error, refresh } = useAdminData()

  const buckets = (metrics?.confidenceBuckets ?? []).map((b) => ({
    key: b.bucket,
    label: b.bucket,
    value: b.count,
  }))

  const asBars = (rows, list) =>
    (rows ?? []).map((r) => ({ key: r.key, label: labelFor(list, r.key), value: r.count }))

  const positiveReasonBars = asBars(metrics?.positiveReasons, POSITIVE_REASONS)
  const negativeReasonBars = asBars(metrics?.negativeReasons, NEGATIVE_REASONS)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
  const accuracyBars = asBars(metrics?.requirementAccuracyFeedback, REQUIREMENT_ACCURACY)
  const completenessBars = asBars(metrics?.requirementCompletenessFeedback, REQUIREMENT_COMPLETENESS)
  const editLevelBars = asBars(metrics?.editLevelFeedback, EDIT_LEVEL)
  const valueRatingBars = asBars(metrics?.valueRatingFeedback, VALUE_RATING)

  const insights = buildFeedbackInsights(metrics)

  return (
    <DataGate error={error} refresh={refresh}>
      <Section
        title="جودة المخرجات"
        en="Quality"
        purpose="كيف يرى المستخدمون جودة النتائج التي ينتجها أريب؟"
      >
        <Panel title="الرضا" en="Satisfaction">
          <div className="ad-kpi-grid">
            <KpiCard label="متوسط التقييم" en="Average Rating" kind="decimal" metric={metrics?.feedbackAvgRating} loading={loading} />
            <KpiCard label="تقييم إيجابي" en="Positive Feedback" kind="percent" metric={metrics?.feedbackPositiveRate} loading={loading} />
            <KpiCard label="تقييم سلبي" en="Negative Feedback" kind="percent" metric={metrics?.feedbackNegativeRate} loading={loading} />
            <KpiCard
              label="نسبة الاستجابة"
              en="Feedback Response Rate"
              kind="percent"
              metric={metrics?.feedbackResponseRate}
              loading={loading}
              hint="نسبة الوثائق التي وصلها تقييم من إجمالي الوثائق المؤهَّلة في هذي الفترة. عدم وجود تقييم لا يعني عدم الرضا."
            />
          </div>
        </Panel>

        <div className="ad-grid-2">
          <Panel title="دقة المتطلبات" hint="تقييم ذاتي من المستخدم — وليس قياس نظام.">
            {accuracyBars.length ? (
              <BarList items={accuracyBars} />
            ) : (
              <EmptyState title="لم تصل تقييمات بعد" hint="بمجرد بدء المستخدمين بتقييم الـPRDs ستظهر جودة المخرجات هنا." />
            )}
          </Panel>
          <Panel title="اكتمال المتطلبات" hint="تقييم ذاتي من المستخدم — منفصل عن الدقة.">
            {completenessBars.length ? (
              <BarList items={completenessBars} />
            ) : (
              <EmptyState title="لم تصل تقييمات بعد" hint="بمجرد بدء المستخدمين بتقييم الـPRDs ستظهر جودة المخرجات هنا." />
            )}
          </Panel>
        </div>

        <div className="ad-grid-2">
          <Panel title="توزيع ثقة الاستخراج" hint="ثقة أريب في المتطلبات اللي استخرجها.">
            <BarList items={buckets} emptyLabel="ما فيه متطلبات في هذي الفترة" />
          </Panel>
          <Panel title="أكثر أسباب التقييم السلبي" hint="أعلى 5 أسباب، من إجمالي التقييمات السلبية.">
            <BarList items={negativeReasonBars} emptyLabel="ما فيه تقييمات سلبية في هذي الفترة" />
          </Panel>
        </div>

        <Panel title="جهد المستخدم" en="User Effort">
          <div className="ad-kpi-grid">
            <KpiCard label="متطلبات مستخرَجة" en="Requirements Generated" metric={metrics?.requirementsGenerated} loading={loading} />
            <KpiCard
              label="نسبة التعديل"
              en="Edit Rate"
              kind="percent"
              metric={metrics?.editRate}
              loading={loading}
              hint="محسوبة من النظام فعليًا — ارتفاعها يشير لضعف في الاستخراج."
            />
            <KpiCard label="متطلبات أضافها المستخدم" en="User-Added" metric={metrics?.requirementsUserAdded} loading={loading} />
          </div>
          <p className="ad-panel-note">التوزيع التالي تقييم ذاتي من المستخدم — إشارة إضافية، وليست بديلًا عن نسبة التعديل الفعلية أعلاه.</p>
          <BarList items={editLevelBars} emptyLabel="لم تصل تقييمات بعد" />
        </Panel>

        <Panel title="القيمة المضافة" en="Product Value" hint="هل ساعد أريب المستخدم يوصل لنتيجة أفضل أو أسرع؟">
          <BarList items={valueRatingBars} emptyLabel="لم تصل تقييمات بعد" />
        </Panel>

        {positiveReasonBars.length > 0 && (
          <Panel title="أكثر أسباب التقييم الإيجابي" hint="من التقييمات الإيجابية فقط.">
            <BarList items={positiveReasonBars} />
          </Panel>
        )}

        <Panel title="ماذا نتعلم من التقييمات؟">
          {insights.available ? (
            <ul className="ad-quality-insights">
              {insights.items.map((item) => (
                <li key={item.id}>
                  <p>{item.text}</p>
                  <p className="ad-quality-insight-hedge">{item.hedge}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد بيانات كافية لاستخراج Insights." />
          )}
        </Panel>

        {(metrics?.feedbackSeries?.length ?? 0) > 1 && (
          <Panel title="اتجاه التقييمات" en="Feedback Trend">
            <TrendChart
              series={metrics.feedbackSeries}
              keys={[
                { key: 'positive', label: 'إيجابي' },
                { key: 'negative', label: 'سلبي' },
              ]}
            />
          </Panel>
        )}

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
