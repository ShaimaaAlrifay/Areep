/* ============================================================
   "What needs your attention" (§04) and alerts (§17).

   These are derived, not authored: each rule reads metrics that are
   actually available and stays silent when they are not. A rule can never
   fire on a metric the product does not measure, so the panel cannot
   invent a concern out of missing data.

   On wording — the spec is explicit and it matters. A correlation is not
   a cause. Nothing here says "because"; every reason is hedged ("قد يكون",
   "يحتاج مراجعة") because the product has no causal evidence, only a
   number that moved. Stating a cause we cannot support would make the
   panel confidently wrong, which is worse than quiet.

   Thresholds come from §17 and are deliberately few: a panel that fires
   on everything is one nobody reads.
   ============================================================ */

const RULES = [
  {
    id: 'activation-drop',
    read: (m) => m.activationRate,
    fires: (mt) => mt.available && mt.change !== null && mt.change <= -10,
    level: 'critical',
    title: 'معدل التفعيل نزل',
    en: 'Activation Rate',
    reason: 'المستخدمون يسجّلون، لكن نسبة أقل منهم تصل إلى توليد وثيقة. قد يكون السبب في خطوة الاكتشاف نفسها.',
    action: 'افتح مسار التفعيل وشوف عند أي مرحلة يتوقفون.',
    to: '/admin/activation',
  },
  {
    id: 'ai-errors',
    read: (m) => m.ai?.errorRate,
    fires: (mt) => mt?.available && mt.value !== null && mt.value >= 5,
    level: 'critical',
    title: 'نسبة أخطاء الذكاء الاصطناعي مرتفعة',
    en: 'AI Error Rate',
    reason: 'قد يكون مزوّد يرفض الطلبات أو تجاوزنا حصة يومية.',
    action: 'راجع صحة المزوّدين وآخر الأخطاء المسجّلة.',
    to: '/admin/ai',
  },
  {
    id: 'fallback',
    read: (m) => m.ai?.fallbackRate,
    fires: (mt) => mt?.available && mt.value !== null && mt.value >= 5,
    level: 'warning',
    title: 'المسار البديل يشتغل أكثر من المعتاد',
    en: 'Fallback Rate',
    reason: 'المزوّد الأساسي يفشل ويتولّى البديل. الجلسات تنجح، لكن على مزوّد احتياطي.',
    action: 'راجع نسبة نجاح المزوّد الأساسي.',
    to: '/admin/ai',
  },
  {
    id: 'retention-drop',
    read: (m) => m.d7,
    fires: (mt) => mt.available && mt.change !== null && mt.change <= -10,
    level: 'warning',
    title: 'العودة بعد ٧ أيام نزلت',
    en: 'D7 Retention',
    reason: 'قد تكون القيمة تُستهلك من أول جلسة ولا يوجد سبب واضح للرجوع.',
    action: 'قارن نسبة المشروع الثاني مع الفترة السابقة.',
    to: '/admin/retention',
  },
  {
    id: 'edit-rate',
    read: (m) => m.editRate,
    fires: (mt) => mt.available && mt.value !== null && mt.value >= 35,
    level: 'warning',
    title: 'نسبة تعديل المتطلبات مرتفعة',
    en: 'Requirements Edit Rate',
    reason: 'المستخدمون يصحّحون كثيرًا مما يستخرجه أريب. لاحظنا ارتباطًا بين هذا وجودة الاستخراج، لكنه يحتاج مراجعة يدوية للتأكد.',
    action: 'اقرأ عيّنة من المتطلبات المعدَّلة وقارنها بالأصل.',
    to: '/admin/quality',
  },
  {
    id: 'prd-growth',
    read: (m) => m.prdsGenerated,
    fires: (mt) => mt.available && mt.change !== null && mt.change >= 15,
    level: 'good',
    title: 'توليد الوثائق ارتفع',
    en: 'PRDs Generated',
    reason: 'عدد الوثائق المولَّدة أعلى من الفترة السابقة.',
    action: 'شوف من أي نوع مشاريع جاء الارتفاع.',
    to: '/admin/projects',
  },
]

const LEVEL_ORDER = { critical: 0, warning: 1, good: 2 }

export function buildInsights(metrics) {
  if (!metrics) return []
  return RULES.map((rule) => {
    const mt = rule.read(metrics)
    if (!mt || !rule.fires(mt)) return null
    return {
      id: rule.id,
      level: rule.level,
      title: rule.title,
      en: rule.en,
      change: mt.change,
      value: mt.value,
      reason: rule.reason,
      action: rule.action,
      to: rule.to,
    }
  })
    .filter(Boolean)
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
    .slice(0, 5)
}

import { labelFor, NEGATIVE_REASONS } from '../../lib/prdFeedbackOptions'

const MIN_FEEDBACK_FOR_INSIGHTS = 5

/**
 * "ماذا نتعلم من التقييمات؟" (spec §17) — Quality-page-local, not the
 * cross-page "needs attention" panel above (that one links elsewhere;
 * these sentences are about feedback itself, so a "go to X page" link
 * would be artificial). Every sentence is computed directly from counts
 * already in `metrics`, always hedged ("قد يشير ذلك إلى..."), never a
 * fabricated cause — the same discipline `buildInsights` follows above.
 */
export function buildFeedbackInsights(metrics) {
  const total = metrics?.feedbackTotal?.value ?? 0
  if (total < MIN_FEEDBACK_FOR_INSIGHTS) return { available: false, items: [] }

  const items = []

  const negativeReasons = metrics?.negativeReasons ?? []
  const negativeTotal = negativeReasons.reduce((s, r) => s + r.count, 0)
  const topNegative = [...negativeReasons].sort((a, b) => b.count - a.count)[0]
  if (topNegative && negativeTotal > 0) {
    const share = (topNegative.count / negativeTotal) * 100
    items.push({
      id: 'top-negative-reason',
      text: `أكثر سبب للتقييم السلبي هو "${labelFor(NEGATIVE_REASONS, topNegative.key)}" — ${share.toFixed(0)}٪ من التقييمات السلبية ذكرته.`,
      hedge:
        topNegative.key === 'missing_requirements'
          ? 'قد يشير ذلك إلى حاجة لمراجعة مرحلة Discovery.'
          : 'قد يشير ذلك إلى فرصة لتحسين هذا الجانب تحديدًا.',
    })
  }

  const completeness = metrics?.requirementCompletenessFeedback ?? []
  const completenessTotal = completeness.reduce((s, r) => s + r.count, 0)
  const incomplete = completeness
    .filter((r) => r.key === 'slightly_incomplete' || r.key === 'clearly_incomplete')
    .reduce((s, r) => s + r.count, 0)
  if (completenessTotal > 0 && incomplete > 0) {
    const share = (incomplete / completenessTotal) * 100
    items.push({
      id: 'completeness-gap',
      text: `${share.toFixed(0)}٪ من التقييمات ذكرت أن المتطلبات كانت ناقصة (قليلًا أو بشكل واضح).`,
      hedge: 'قد يشير ذلك إلى حاجة لتوسيع تغطية جلسة الاكتشاف قبل توليد الوثيقة.',
    })
  }

  return { available: items.length > 0, items }
}

/* System health (§13): a status per subsystem, tied to real signals only.
   "unknown" is a first-class state — a subsystem with no telemetry is not
   healthy, it is unmeasured, and saying otherwise would be a false all-clear. */
export function buildHealth(metrics) {
  const ai = metrics?.ai
  const rows = []

  if (!ai?.available) {
    rows.push({ key: 'ai', label: 'توليد الذكاء الاصطناعي', en: 'AI Generation', status: 'unknown', detail: ai?.reason ?? 'لا توجد بيانات بعد.' })
  } else if (!ai.requests.value) {
    /* Tracking is live but nothing ran in this window. That is neither
       healthy nor broken — it is unobserved, and the row says so. */
    rows.push({
      key: 'ai',
      label: 'توليد الذكاء الاصطناعي',
      en: 'AI Generation',
      status: 'unknown',
      detail: 'ما فيه استدعاءات في هذي الفترة.',
    })
  } else {
    const err = ai.errorRate.value ?? 0
    rows.push({
      key: 'ai',
      label: 'توليد الذكاء الاصطناعي',
      en: 'AI Generation',
      status: err >= 5 ? 'critical' : err >= 1 ? 'warning' : 'healthy',
      detail: `${err.toFixed(1)}٪ من الاستدعاءات فشلت (من ${ai.requests.value})`,
      lastEvent: ai.recentFailures?.[0]?.at ?? null,
    })
    const fb = ai.fallbackRate.value ?? 0
    rows.push({
      key: 'fallback',
      label: 'المسار البديل',
      en: 'Provider Fallback',
      status: fb >= 5 ? 'warning' : 'healthy',
      detail: `${fb.toFixed(1)}٪ من الطلبات خدمها البديل`,
    })
  }

  rows.push({
    key: 'export',
    label: 'تصدير الوثيقة',
    en: 'PDF Export',
    status: 'unknown',
    detail: 'التصدير يتم داخل المتصفح ولا يُسجَّل — لا توجد إشارة نجاح أو فشل تصل للخادم.',
  })

  return rows
}
