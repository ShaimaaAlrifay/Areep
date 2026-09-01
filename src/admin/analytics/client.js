/* ============================================================
   The one place the dashboard gets numbers from.

   Everything above this file consumes the `metric()` shape and never
   touches Supabase, a table name, or a raw row. That is what makes the
   swap the spec asks for (§23) a change in this file alone: when a
   metric that is "not tracked" today gains real tracking, only its
   selector below changes — no component moves.

   Nothing is invented. Metrics the product genuinely cannot measure yet
   are returned as notTracked() with the reason spelled out, so the UI can
   say what is missing instead of showing a confident zero.
   ============================================================ */
import { supabase } from '../../lib/supabase'
import { metric, notTracked } from './metric'

/* Reasons, written once so the same gap reads identically everywhere. */
export const REASONS = {
  NO_WEB_ANALYTICS: 'يحتاج مزوّد تحليلات — VITE_ANALYTICS_URL غير مضبوط، وواجهة الأحداث لا ترسل شيئًا حاليًا.',
  NO_BILLING: 'لا يوجد نظام فوترة في المنتج بعد — لا اشتراكات ولا مدفوعات لتُقاس.',
  NO_ACCURACY: 'لا توجد طريقة حقيقية لقياس دقة الوثيقة — أي رقم هنا سيكون مُختلقًا.',
  NO_PRD_HISTORY: 'إعادة التوليد تستبدل الوثيقة السابقة، فلا يوجد تاريخ إصدارات لحسابها.',
  COLLECTING: 'التتبّع مُفعّل، لكن ما وصلت بيانات كافية بعد.',
}

export async function fetchAnalytics({ from, to, compareFrom, compareTo }) {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('admin-analytics', {
    body: { from, to, compareFrom, compareTo },
  })
  if (error) {
    /* 403 is a real answer, not a failure: the caller is signed in but is
       not an owner. The shell turns this into a refusal screen rather
       than an error toast. */
    const status = error?.context?.status
    return { data: null, error: status === 403 ? 'forbidden' : 'unavailable' }
  }
  return { data, error: null }
}

const num = (v) => (v === null || v === undefined ? null : Number(v))

/* The SQL returns funnel steps as stable keys; the Arabic wording lives
   here so a copy change never means touching a migration. */
const FUNNEL_LABELS = {
  signup: 'سجّل حساب',
  project: 'أنشأ مشروع',
  discovery: 'بدأ جلسة الاكتشاف',
  completed: 'أكمل الاكتشاف',
  prd: 'ولّد وثيقة',
}

const DAY = 86400000

/**
 * Cohort maturity, measured conservatively.
 *
 * A cohort is a whole week, so its youngest member joined up to seven
 * days after the label on the row. Age is therefore counted from the END
 * of that week: at any moment, every member of the cohort has been around
 * at least that long. Counting from the start instead would let a D7
 * column light up for a cohort whose last joiners are on day two, and
 * their not-yet-returns would be counted as returns that never came.
 */
function cohortAgeDays(weekStart) {
  const end = new Date(weekStart).getTime() + 7 * DAY
  return Math.floor((Date.now() - end) / DAY)
}

/* width_bucket(confidence, 0, 100, 5) * 20 yields 20..100, plus a 120
   overflow bucket for confidence exactly at 100 — folded back into the
   top band so the chart does not grow a phantom sixth bar. */
function confidenceLabel(bucket) {
  const b = Number(bucket)
  // Must be byte-identical to the label b=100 produces, or the fold is a
  // no-op and the chart grows a phantom sixth bar.
  if (b >= 120) return '80–100'
  return `${Math.max(0, b - 20)}–${b}`
}

/* Two SQL buckets can share one label (the 100 overflow folds into
   81–100), so counts are summed rather than the second row silently
   overwriting the first. */
function mergeBuckets(rows) {
  const out = new Map()
  for (const row of rows) {
    const label = confidenceLabel(row.bucket)
    out.set(label, (out.get(label) ?? 0) + Number(row.count ?? 0))
  }
  return [...out].map(([bucket, count]) => ({ bucket, count }))
}

/* Below this sample size, a KPI card still shows the real number but adds
   a hedge — not a separate "unreliable" state, just a note, since the
   number itself is not wrong, only thin. */
const MIN_RELIABLE_FEEDBACK_SAMPLE = 10
const limitedSampleNote = (n) => (n !== null && n !== undefined && n < MIN_RELIABLE_FEEDBACK_SAMPLE ? 'عيّنة محدودة — احذر الاستنتاج المبكر.' : null)

/* `{reason|value, count}` rows from admin_analytics() → BarList's
   `{key, label, value}` shape. Label resolution happens at render time in
   Quality.jsx via prdFeedbackOptions.labelFor, so this file stays a pure
   passthrough of counts (same "nothing invented" boundary as the rest of
   this selector). */
const toCounts = (rows, field) => (rows ?? []).map((r) => ({ key: r[field], count: Number(r.count ?? 0) }))

/** Raw payload → the metric shape every component reads. */
export function selectMetrics(raw) {
  if (!raw) return null
  const a = raw.acquisition ?? {}
  const act = raw.activation ?? {}
  const eng = raw.engagement ?? {}
  const q = raw.quality ?? {}
  const ret = raw.retention ?? {}
  const ai = raw.ai ?? null
  const fb = raw.feedback ?? {}
  /* Coerced once and compared numerically. A bare truthiness check would
     treat the string "0" as a live request count and divide by it. */
  const aiRequests = ai ? Number(ai.requests ?? 0) : 0
  const series = raw.series ?? []

  const trend = (key) => series.map((d) => Number(d[key] ?? 0))

  const funnel = (act.funnel ?? []).map((s) => ({
    key: s.key,
    label: FUNNEL_LABELS[s.key] ?? s.key,
    users: Number(s.users ?? 0),
  }))
  const stage = (key) => Number(funnel.find((s) => s.key === key)?.users ?? 0)
  const signups = num(a.signups)
  const activated = stage('prd')
  const activationRate = signups ? (activated / signups) * 100 : null

  const cohorts = (ret.cohorts ?? []).map((c) => ({
    cohort: c.week,
    size: Number(c.size ?? 0),
    d1: Number(c.d1 ?? 0),
    d7: Number(c.d7 ?? 0),
    d30: Number(c.d30 ?? 0),
    ageDays: cohortAgeDays(c.week),
  }))
  const weighted = (k) => {
    const size = cohorts.reduce((s, c) => s + Number(c.size || 0), 0)
    if (!size) return null
    return (cohorts.reduce((s, c) => s + Number(c[k] || 0), 0) / size) * 100
  }

  const generated = num(q.requirementsGenerated)
  const edited = num(q.requirementsEdited)

  return {
    generatedAt: raw.generatedAt,

    // ---- acquisition ----
    visitors: notTracked(REASONS.NO_WEB_ANALYTICS),
    trafficSources: notTracked(REASONS.NO_WEB_ANALYTICS),
    signupRate: notTracked(REASONS.NO_WEB_ANALYTICS, 'يلزم عدد الزوّار لحسابه.'),
    signups: metric({ value: signups, previousValue: num(a.signupsPrevious), trend: trend('signups') }),

    // ---- activation ----
    projectsCreated: metric({
      value: num(act.projectsCreated),
      previousValue: num(act.projectsCreatedPrevious),
      trend: trend('projects'),
    }),
    prdsGenerated: metric({
      value: num(act.prdsGenerated),
      previousValue: num(act.prdsGeneratedPrevious),
      trend: trend('prds'),
      note: act.prdsBeforeTracking
        ? `${act.prdsBeforeTracking} وثيقة أُنشئت قبل بدء تتبّع وقت التوليد، وليست ضمن هذه الفترة.`
        : null,
    }),
    activationRate: metric({
      value: activationRate,
      previousValue: num(act.activationRatePrevious),
      sampleSize: signups,
    }),
    /* Per-day signup cohorts and whether they've reached a PRD yet — same
       definition as the funnel's last stage, just bucketed by day. Days
       with no signups (cohortSize 0) carry a null rate rather than 0, so
       an empty day doesn't plot as "nobody converted". */
    activationDaily: (act.dailyRate ?? []).map((d) => ({
      day: d.day,
      cohortSize: Number(d.cohortSize ?? 0),
      rate: d.rate === null || d.rate === undefined ? null : Number(d.rate),
    })),
    funnel,

    // ---- engagement ----
    messagesPerProject: metric({ value: num(eng.avgMessagesPerProject) }),
    projectsPerUser: metric({ value: num(eng.avgProjectsPerUser) }),
    timeToPrd:
      eng.timeToPrdSampleSize > 0
        ? metric({ value: num(eng.medianTimeToPrdSeconds), sampleSize: eng.timeToPrdSampleSize, lowerIsBetter: true })
        : notTracked(REASONS.COLLECTING, 'يُحسب من لحظة إنشاء المشروع حتى أول توليد وثيقة.'),

    // ---- quality ----
    requirementsGenerated: metric({ value: generated }),
    requirementsEdited: metric({ value: edited }),
    editRate: metric({
      value: generated ? (edited / generated) * 100 : null,
      note: 'نسبة المتطلبات التي عدّلها المستخدم قبل التوليد.',
    }),
    requirementsUserAdded: metric({ value: num(q.requirementsUserAdded) }),
    prdAccuracy: notTracked(REASONS.NO_ACCURACY),
    regenerationRate: notTracked(REASONS.NO_PRD_HISTORY),

    // ---- PRD feedback (real, once submitted — see admin_analytics()'s
    // `feedback` key, always present with real zeroes, never notTracked) ----
    feedbackTotal: metric({ value: num(fb.totalSubmitted), previousValue: num(fb.totalSubmittedPrevious) }),
    feedbackResponseRate: metric({ value: num(fb.responseRate), sampleSize: num(fb.eligiblePrds) }),
    feedbackPositiveRate:
      num(fb.totalSubmitted) > 0
        ? metric({ value: (Number(fb.sentiment?.positive ?? 0) / Number(fb.totalSubmitted)) * 100, sampleSize: num(fb.totalSubmitted) })
        : notTracked(REASONS.COLLECTING),
    feedbackNegativeRate:
      num(fb.totalSubmitted) > 0
        ? metric({
            value: (Number(fb.sentiment?.negative ?? 0) / Number(fb.totalSubmitted)) * 100,
            sampleSize: num(fb.totalSubmitted),
            lowerIsBetter: true,
          })
        : notTracked(REASONS.COLLECTING),
    feedbackAvgRating:
      num(fb.ratingSampleSize) > 0
        ? metric({ value: num(fb.avgRating), sampleSize: num(fb.ratingSampleSize), note: limitedSampleNote(fb.ratingSampleSize) })
        : notTracked(REASONS.COLLECTING),
    feedbackRatingDistribution: (fb.ratingDistribution ?? []).map((r) => ({ key: r.stars, count: Number(r.count ?? 0) })),
    positiveReasons: toCounts(fb.positiveReasons, 'reason'),
    negativeReasons: toCounts(fb.negativeReasons, 'reason'),
    requirementAccuracyFeedback: toCounts(fb.requirementAccuracy, 'value'),
    requirementCompletenessFeedback: toCounts(fb.requirementCompleteness, 'value'),
    editLevelFeedback: toCounts(fb.editLevel, 'value'),
    valueRatingFeedback: toCounts(fb.valueRating, 'value'),
    feedbackSeries: fb.series ?? [],

    // ---- retention ----
    d1: cohorts.length ? metric({ value: weighted('d1') }) : notTracked(REASONS.COLLECTING),
    d7: cohorts.length ? metric({ value: weighted('d7') }) : notTracked(REASONS.COLLECTING),
    d30: cohorts.length ? metric({ value: weighted('d30') }) : notTracked(REASONS.COLLECTING),
    secondProjectRate:
      ret.secondProjectRate === null || ret.secondProjectRate === undefined
        ? notTracked(REASONS.COLLECTING)
        : metric({ value: num(ret.secondProjectRate) }),
    cohorts,

    // ---- revenue ----
    mrr: notTracked(REASONS.NO_BILLING),
    arpu: notTracked(REASONS.NO_BILLING),
    trialToPaid: notTracked(REASONS.NO_BILLING),
    churn: notTracked(REASONS.NO_BILLING),

    // ---- ai operations ----
    ai: ai
      ? {
          available: true,
          requests: metric({ value: num(ai.requests) }),
          /* With zero requests there is no rate — not a rate of zero. A
             green "0٪ أخطاء" over a period nothing ran in reads as an
             all-clear for a system that was never exercised. */
          errorRate: metric({
            value: aiRequests > 0 ? (Number(ai.failed) / aiRequests) * 100 : null,
            sampleSize: aiRequests,
            lowerIsBetter: true,
          }),
          fallbackRate: metric({
            value: aiRequests > 0 ? (Number(ai.fallbackServed) / aiRequests) * 100 : null,
            sampleSize: aiRequests,
            lowerIsBetter: true,
          }),
          inputTokens: ai.inputTokens === null ? notTracked('المزوّد لم يُبلّغ عن عدد التوكينز.') : metric({ value: num(ai.inputTokens) }),
          outputTokens: ai.outputTokens === null ? notTracked('المزوّد لم يُبلّغ عن عدد التوكينز.') : metric({ value: num(ai.outputTokens) }),
          /* Success is just 1 - errorRate, but the KPI strip shows both
             because an owner scanning for "is this fine?" reads a rate
             framed as success faster than one framed as failure. Derived
             from errorRate rather than recomputed, so the two can never
             disagree. */
          successRate: ai.requests
            ? metric({ value: 100 - ((Number(ai.failed) / Number(ai.requests)) * 100), sampleSize: num(ai.requests) })
            : metric({ value: null }),
          totalTokens:
            ai.inputTokens === null
              ? notTracked('المزوّد لم يُبلّغ عن عدد التوكينز.')
              : metric({
                  value: Number(ai.inputTokens) + (ai.outputTokens === null ? 0 : Number(ai.outputTokens)),
                  note: ai.outputTokens === null ? 'يشمل المدخلات فقط — المخرجات غير مُبلَّغة.' : null,
                }),
          /* Cost stays untracked until a price per model is configured —
             tokens alone are not money, and guessing a rate would put an
             invented dollar figure on the page. */
          costPerPrd: notTracked('يلزم ضبط سعر لكل نموذج لتحويل التوكينز إلى تكلفة.'),
          byProvider: (ai.byProvider ?? []).map((p) => ({
            provider: p.provider,
            requests: Number(p.requests ?? 0),
            ok: Number(p.succeeded ?? 0),
            failed: Number(p.failed ?? 0),
            fallbackServed: Number(p.served_as_fallback ?? 0),
            /* null, not 0: a provider whose calls all failed reported no
               successful duration to average. */
            avgDurationMs: p.avg_ms === null || p.avg_ms === undefined ? null : Number(p.avg_ms),
          })),
          byKind: ai.byKind ?? [],
          recentFailures: ai.recentFailures ?? [],
        }
      : { available: false, reason: REASONS.COLLECTING },

    // ---- projects ----
    projectTypes: raw.projects?.byType ?? [],
    confidenceBuckets: mergeBuckets(raw.projects?.confidenceBuckets ?? []),
    totalProjects: metric({ value: num(raw.projects?.total) }),

    /* A feed, not a metric — kept outside metric()/notTracked() because
       there is nothing to compare it against and no unit to format. Every
       row is `{ kind, at }` and nothing else; the SQL side already refuses
       to attach an id, an email, or a project name to any of it. */
    recentActivity: (raw.recentActivity ?? []).map((e) => ({ kind: e.kind, at: e.at })),
  }
}
