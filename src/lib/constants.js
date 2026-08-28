// Labels kept in one place so every screen shows the exact same Arabic
// copy for the schema's fixed enum values (projects.status, projects.project_type).

export const STATUS_LABELS = {
  discovery: 'الاكتشاف',
  ready_for_review: 'جاهز للمراجعة',
  prd_generated: 'تم إنشاء PRD',
  completed: 'مكتمل',
}

export const STATUS_ORDER = ['discovery', 'ready_for_review', 'prd_generated', 'completed']

export const PROJECT_TYPE_LABELS = {
  mobile_app: 'تطبيق جوال',
  web_app: 'تطبيق ويب',
  saas: 'منصة SaaS',
  ecommerce: 'متجر إلكتروني',
  internal_system: 'نظام داخلي',
  marketplace: 'سوق إلكتروني',
  landing_page: 'صفحة هبوط',
  dashboard: 'لوحة تحكم',
  api_backend: 'واجهة برمجية (API)',
  other: 'أخرى',
}

export const PROJECT_TYPE_ORDER = [
  'mobile_app',
  'web_app',
  'saas',
  'ecommerce',
  'internal_system',
  'marketplace',
  'landing_page',
  'dashboard',
  'api_backend',
  'other',
]

// Requirements engine enums (spec sections 9, 25-26) — mirrors the
// `requirements.type` / `requirements.priority` check constraints in
// supabase/schema.sql. REQUIREMENT_TYPE_PREFIX must match the id/req_key
// prefixes the Gemini discovery prompt is instructed to emit (see
// server/prompts/gemini/discovery.system.js) — used to compute the next
// sequential req_key when a user manually adds a requirement.
export const REQUIREMENT_TYPE_LABELS = {
  goal: 'الهدف من المشروع',
  target_user: 'مستخدم مستهدف',
  feature: 'ميزة أساسية',
  functional: 'متطلب وظيفي',
  non_functional: 'متطلب غير وظيفي',
  risk: 'خطر',
  assumption: 'افتراض',
}

export const REQUIREMENT_TYPE_ORDER = ['goal', 'target_user', 'feature', 'functional', 'non_functional', 'risk', 'assumption']

export const REQUIREMENT_TYPE_PREFIX = {
  goal: 'GOAL',
  target_user: 'USER',
  feature: 'FEAT',
  functional: 'FR',
  non_functional: 'NFR',
  risk: 'RISK',
  assumption: 'ASM',
}

export const PRIORITY_LABELS = {
  'Must Have': 'أساسي',
  'Should Have': 'مهم',
  'Could Have': 'اختياري',
  "Won't Have": 'مؤجل',
  Unspecified: 'غير محدد',
}

export const PRIORITY_ORDER = ['Must Have', 'Should Have', 'Could Have', "Won't Have", 'Unspecified']

export function formatDate(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('ar', { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(value),
    )
  } catch {
    return value
  }
}

const RELATIVE_UNITS = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

/** Quiet "relative-ish" timestamp for sidebar rows — falls back to formatDate on failure. */
export function formatRelativeDate(value) {
  if (!value) return '—'
  try {
    const date = new Date(value)
    const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
    const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })

    if (Math.abs(diffSeconds) < 60) return 'الآن'

    for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
      if (Math.abs(diffSeconds) >= secondsInUnit) {
        return rtf.format(Math.round(diffSeconds / secondsInUnit), unit)
      }
    }
    return formatDate(value)
  } catch {
    return formatDate(value)
  }
}

/** Translates the handful of Supabase auth error messages users actually hit. */
export function translateAuthError(error) {
  if (!error) return null
  const message = error.message || ''
  const map = {
    'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'User already registered': 'هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول.',
    'Email not confirmed': 'يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المُرسل إليك.',
    'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
  }
  return map[message] || message || 'حدث خطأ غير متوقع. حاول مرة أخرى.'
}
