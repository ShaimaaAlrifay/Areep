import { Link } from 'react-router-dom'
import { KpiCard } from '../components/KpiCard'
import { InsightCard } from '../components/InsightCard'
import { ProductHealth } from '../components/ProductHealth'
import { RecentActivity } from '../components/RecentActivity'
import { GrowthChart } from '../components/GrowthChart'
import { Funnel } from '../components/charts'
import { EmptyState } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { formatChange, formatValue } from '../analytics/metric'
import { buildProductHealth } from '../analytics/health'

/* ============================================================
   The first screen, and the only one built to be read in thirty seconds
   rather than studied.

   The order below is not visual taste — it is the sequence of questions
   an owner actually asks, in the order they ask them: is Areeb okay →
   does anything need me right now → the headline numbers → is it growing
   → where do we lose people → is what we ship any good → do people come
   back → what is the AI costing us → what just happened. Every section
   after the first two is a summary with a link, not the full page — the
   full page is where SOMEONE ASKING THAT SPECIFIC QUESTION goes to dig,
   which is also why Overview stays six KPIs and not sixteen.
   ============================================================ */
export function Overview() {
  const { metrics, loading, error, insights, refresh, range } = useAdminData()
  const health = buildProductHealth(metrics, insights)

  return (
    <DataGate error={error} refresh={refresh}>
      <Section
        title="نظرة عامة"
        en="Overview"
        purpose={`رؤية شاملة لأداء أريب ونمو المنتج وجودة المخرجات — ${range?.preset?.label ?? '—'}.`}
      >
        <ProductHealth health={health} loading={loading} />

        <Panel title="يحتاج انتباهك" hint="مبني على المؤشرات المتاحة فقط — الأسباب اجتهاد، مو تشخيص مؤكد.">
          {loading ? (
            <div className="ad-insight-grid">
              <div className="ad-insight is-loading" />
              <div className="ad-insight is-loading" />
            </div>
          ) : insights.length === 0 ? (
            <EmptyState title="ما فيه شيء يحتاج انتباهك الحين" hint="ما تجاوز أي مؤشر متابَع حدوده في هذي الفترة." />
          ) : (
            <div className="ad-insight-grid">
              {insights.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          )}
        </Panel>

        <div className="ad-kpi-grid">
          <KpiCard label="الزوّار" en="Visitors" metric={metrics?.visitors} loading={loading} to="/admin/acquisition" />
          <KpiCard label="تسجيلات جديدة" en="Signups" metric={metrics?.signups} loading={loading} to="/admin/acquisition" />
          <KpiCard label="مشاريع أُنشئت" en="Projects" metric={metrics?.projectsCreated} loading={loading} to="/admin/activation" />
          <KpiCard label="وثائق مولَّدة" en="PRDs Generated" metric={metrics?.prdsGenerated} loading={loading} to="/admin/prds" />
          <KpiCard label="معدل التفعيل" en="Activation Rate" kind="percent" metric={metrics?.activationRate} loading={loading} to="/admin/activation" />
          <KpiCard label="العودة بعد 7 أيام" en="D7 Retention" kind="percent" metric={metrics?.d7} loading={loading} to="/admin/retention" />
        </div>

        <Panel title="النمو" hint="اختر مؤشرًا لتشوف اتجاهه عبر الفترة." wide>
          {loading ? <div className="ad-panel-loading" /> : <GrowthChart metrics={metrics} />}
        </Panel>

        <div className="ad-grid-2">
          <Panel
            title="أعلى القمع"
            hint={metrics?.visitors?.available === false ? 'الزوّار غير متتبَّعين بعد — القمع يبدأ من التسجيل.' : undefined}
          >
            {loading ? (
              <div className="ad-panel-loading" />
            ) : metrics?.funnel?.length ? (
              <Funnel steps={metrics.funnel.slice(0, 2)} />
            ) : (
              <EmptyState />
            )}
            <Link to="/admin/activation" className="ad-panel-link">
              مسار التفعيل الكامل ←
            </Link>
          </Panel>

          <Panel title="التفعيل" hint="من إنشاء المشروع إلى وثيقة مولَّدة.">
            {loading ? (
              <div className="ad-panel-loading" />
            ) : metrics?.funnel?.length ? (
              <Funnel steps={metrics.funnel.slice(1)} />
            ) : (
              <EmptyState />
            )}
            <Link to="/admin/activation" className="ad-panel-link">
              تعريف التفعيل والتفاصيل ←
            </Link>
          </Panel>
        </div>

        <div className="ad-mini-row">
          <MiniPanel to="/admin/quality" title="الجودة" en="Quality">
            <MiniStat label="نسبة التعديل" metric={metrics?.editRate} kind="percent" loading={loading} />
            <MiniStat label="متطلبات مستخرَجة" metric={metrics?.requirementsGenerated} loading={loading} />
          </MiniPanel>

          <MiniPanel to="/admin/retention" title="الاحتفاظ" en="Retention">
            <MiniStat label="D7" metric={metrics?.d7} kind="percent" loading={loading} />
            <MiniStat label="مشروع ثانٍ" metric={metrics?.secondProjectRate} kind="percent" loading={loading} />
          </MiniPanel>

          <MiniPanel to="/admin/ai" title="عمليات الذكاء الاصطناعي" en="AI Operations">
            {metrics?.ai?.available === false ? (
              <p className="ad-mini-empty">{metrics.ai.reason}</p>
            ) : (
              <>
                <MiniStat label="نسبة الفشل" metric={metrics?.ai?.errorRate} kind="percent" loading={loading} />
                <MiniStat label="المسار البديل" metric={metrics?.ai?.fallbackRate} kind="percent" loading={loading} />
              </>
            )}
          </MiniPanel>
        </div>

        <Panel title="آخر نشاط" hint="بدون أي بيانات تعريفية — نوع الحدث والوقت فقط." wide>
          <RecentActivity events={metrics?.recentActivity ?? []} loading={loading} />
        </Panel>
      </Section>
    </DataGate>
  )
}

/** A condensed summary card: two numbers and a link, not a full page. */
function MiniPanel({ to, title, en, children }) {
  return (
    <Link to={to} className="ad-mini-panel">
      <header className="ad-mini-head">
        <h3>{title}</h3>
        <span>{en}</span>
      </header>
      <div className="ad-mini-body">{children}</div>
      <span className="ad-mini-link" aria-hidden="true">
        ←
      </span>
    </Link>
  )
}

function MiniStat({ label, metric, kind = 'number', loading }) {
  if (loading) {
    return (
      <div className="ad-mini-stat">
        <span className="ad-skeleton" style={{ width: 60, height: 20, borderRadius: 5 }} />
        <span className="ad-mini-stat-label">{label}</span>
      </div>
    )
  }
  if (!metric?.available) {
    return (
      <div className="ad-mini-stat is-muted">
        <strong>—</strong>
        <span className="ad-mini-stat-label">{label}</span>
      </div>
    )
  }
  return (
    <div className="ad-mini-stat">
      <strong>{formatValue(metric.value, kind)}</strong>
      <span className="ad-mini-stat-label">{label}</span>
      {metric.change !== null && (
        <span className={`ad-mini-stat-change ad-change-${metric.status}`}>{formatChange(metric.change)}</span>
      )}
    </div>
  )
}
