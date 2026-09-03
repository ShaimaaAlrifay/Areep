/* ============================================================
   Quota decisions for discovery/prd, on top of check_and_reserve_ai_usage
   / finalize_ai_usage in Postgres (see the "AI usage & quota phase" in
   schema.sql for why the atomicity lives there and not here).

   Nothing in this file trusts the frontend for identity, token counts or
   limits — every call takes the user id already verified by
   authenticatedUser() and returns numbers computed in the database.
   ============================================================ */
import { rpc } from './serviceClient.ts'

export type RequestType = 'discovery' | 'prd' | 'regeneration'

export interface QuotaLimits {
  tokensPerMonth: number
  requestsPerDay: number
  maxProjectsPerUser: number
  maxPrdGenerationsPerMonth: number
  maxRegenerationsPerProject: number
  maxTokensPerRequest: number
}

interface QuotaApproval {
  allowed: true
  reservedTokens: number
  limits: QuotaLimits
}

interface QuotaRejection {
  allowed: false
  reason: string
  limits: QuotaLimits
}

export type QuotaDecision = QuotaApproval | QuotaRejection

/** Every machine error code this system can hand back, paired with the
 *  Arabic copy the frontend renders verbatim — never a raw provider or
 *  Postgres error reaches the client. */
const ERROR_COPY: Record<string, { status: number; message: string }> = {
  QUOTA_EXCEEDED: { status: 429, message: 'وصلتِ للحد الشهري لاستخدام أريب. يتجدد استخدامك في بداية الشهر القادم.' },
  DAILY_LIMIT_EXCEEDED: { status: 429, message: 'وصلتِ للحد اليومي من الطلبات. جربي مرة ثانية بكرة.' },
  REQUEST_TOO_LARGE: { status: 413, message: 'الطلب الحالي كبير جدًا. حاولي تقسيم المحادثة أو البدء بمشروع جديد.' },
  PRD_LIMIT_EXCEEDED: { status: 429, message: 'وصلتِ للحد الشهري لتوليد الوثائق. يتجدد استخدامك في بداية الشهر القادم.' },
  REGENERATION_LIMIT_EXCEEDED: {
    status: 429,
    message: 'وصلتِ للحد الأقصى لإعادة توليد وثيقة هذا المشروع.',
  },
  AI_RATE_LIMITED: { status: 503, message: 'أريب مشغول حاليًا. جربي مرة ثانية بعد قليل.' },
  AI_UNAVAILABLE: { status: 502, message: 'تعذّر الوصول لأريب حاليًا. حاول مرة ثانية.' },
  AI_ERROR: { status: 502, message: 'واجهنا مشكلة غير متوقعة. حاول مرة ثانية.' },
}

export function errorResponseBody(code: string): { status: number; body: { error: string; message: string } } {
  const entry = ERROR_COPY[code] ?? ERROR_COPY.AI_ERROR
  return { status: entry.status, body: { error: code, message: entry.message } }
}

/**
 * Rough, dependency-free size guard — 1 token ≈ 4 characters, the
 * standard rule of thumb for English/JSON-shaped payloads. Only used to
 * reject an obviously oversized request before a provider is ever called
 * (spec's REQUEST_TOO_LARGE); the authoritative count always comes back
 * from the provider itself after a call actually happens.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * The one call every AI endpoint makes before touching Gemini or Groq.
 * Locks and reserves against this user's current-month usage row in one
 * atomic round trip — see check_and_reserve_ai_usage() in Postgres for
 * how the race between concurrent requests from the same user is closed.
 */
export async function checkAndReserveQuota(
  userId: string,
  requestType: RequestType,
  projectId: string | null,
): Promise<QuotaDecision> {
  return rpc<QuotaDecision>('check_and_reserve_ai_usage', {
    p_user_id: userId,
    p_request_type: requestType,
    p_project_id: projectId,
  })
}

/**
 * Reconciles a reservation to the real token count once the provider has
 * answered (or releases it in full, actualTokens = 0, when the call
 * failed and consumed nothing). Fire-and-forget-safe to call but always
 * awaited here: unlike ai_events telemetry, this one write IS the
 * quota — losing it would let usage drift from what was actually spent.
 */
export async function finalizeQuota(userId: string, reservedTokens: number, actualTokens: number): Promise<void> {
  try {
    await rpc('finalize_ai_usage', {
      p_user_id: userId,
      p_reserved_tokens: reservedTokens,
      p_actual_tokens: actualTokens,
    })
  } catch (error) {
    console.warn('[quota] finalize_ai_usage failed:', error instanceof Error ? error.message : String(error))
  }
}
