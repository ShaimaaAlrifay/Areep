/* ============================================================
   POST /functions/v1/prd
   Body: { projectId, projectName, requirements: { goal: [...], ... } }

   Replaces server/routes/prd.js. Payload trimming, provider order and the
   server-side metadata override are carried over unchanged.

   Groq is primary here, not Gemini (spec sections 27-29: Groq receives
   requirements JSON only, as Senior Product Manager + Technical Writer).
   Gemini is the resilience fallback — the mirror image of discovery.

   This is the route the 150s Free-plan limit actually threatens: a PRD is
   the longest generation in the product. Budgets below are sized so the
   full fallback chain still fits, and _shared/chain.ts skips a candidate
   rather than starting one it cannot finish.
   ============================================================ */
import { Deadline, parseValidated, runChain, type Attempt } from '../_shared/chain.ts'
import { authenticatedUser } from '../_shared/auth.ts'
import { handlePreflight, jsonResponse } from '../_shared/cors.ts'
import { sanitizeProjectSlug } from '../_shared/prdUtils.ts'
import { PRD_SYSTEM_PROMPT } from '../_shared/prompts/prd.ts'
import { callGemini, geminiKeys, type ChatMessage } from '../_shared/providers/gemini.ts'
import { callGroq, groqKey } from '../_shared/providers/groq.ts'
import { validatePrdResponse } from '../_shared/validatePrdResponse.ts'

const GENERIC_ERROR_MESSAGE = 'واجهنا مشكلة أثناء بناء الوثيقة. حاول مرة ثانية.'

const REQUIREMENT_TYPES = ['goal', 'target_user', 'feature', 'functional', 'non_functional', 'risk', 'assumption']

const TOTAL_BUDGET_MS = 110_000
/* A full PRD is a long structured document, so these are generous
   compared with discovery's. Groq gets the larger slice as the primary;
   Gemini's is sized so that a Groq timeout still leaves room for it —
   55 + 45 = 100s, inside the 110s budget. */
const GROQ_TIMEOUT_MS = 55_000
const GEMINI_TIMEOUT_MS = 45_000

interface RequirementInput {
  req_key?: unknown
  title?: unknown
  description?: unknown
  priority?: unknown
}

/**
 * Trims the frontend's requirementsByType payload to the fields the model
 * needs, dropping id/status/source/timestamps — same "send only what the
 * prompt asks for" discipline as the discovery history filter.
 */
function buildRequirementsPayload(requirements: Record<string, unknown> | undefined) {
  const grouped: Record<string, unknown[]> = {}
  let total = 0

  for (const type of REQUIREMENT_TYPES) {
    const list = Array.isArray(requirements?.[type]) ? (requirements![type] as RequirementInput[]) : []
    grouped[type] = list
      .filter((item) => item && typeof item.title === 'string' && item.title.trim())
      .map((item) => ({
        req_key: typeof item.req_key === 'string' ? item.req_key : null,
        title: item.title,
        description: typeof item.description === 'string' ? item.description : '',
        priority: item.priority || 'Unspecified',
      }))
    total += grouped[type].length
  }

  return { grouped, total }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')

  const preflight = handlePreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed', message: 'الطلب غير مدعوم.' }, 405, origin)
  }

  /* verify_jwt has already accepted *a* credential; this is what narrows
     that to a signed-in user. See _shared/auth.ts — the publishable key
     is public and otherwise gets in. */
  const user = authenticatedUser(req)
  if (!user) {
    return jsonResponse({ error: 'unauthorized', message: 'يلزم تسجيل الدخول.' }, 401, origin)
  }

  let body: { projectId?: string; projectName?: string; requirements?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_request', message: 'صيغة الطلب غير صحيحة.' }, 400, origin)
  }

  const { projectId, projectName, requirements } = body
  const { grouped, total } = buildRequirementsPayload(requirements)

  if (total === 0) {
    return jsonResponse(
      { error: 'invalid_request', message: 'لا توجد متطلبات كافية لتوليد وثيقة PRD بعد.' },
      400,
      origin,
    )
  }

  const userMessage = JSON.stringify({
    project_name: typeof projectName === 'string' && projectName.trim() ? projectName.trim() : 'مشروع بدون اسم',
    requirements: grouped,
  })
  const messages: ChatMessage[] = [{ role: 'user', content: userMessage }]

  const attempts: Attempt<any>[] = []

  const groq = groqKey()
  if (groq) {
    attempts.push({
      label: 'groq-primary',
      timeoutMs: GROQ_TIMEOUT_MS,
      run: async (signal: AbortSignal) =>
        parseValidated(await callGroq(groq, PRD_SYSTEM_PROMPT, messages, signal), validatePrdResponse, 'PRD response'),
    })
  }

  for (const [i, key] of geminiKeys().entries()) {
    attempts.push({
      label: `gemini-fallback-key${i + 1}`,
      timeoutMs: GEMINI_TIMEOUT_MS,
      run: async (signal: AbortSignal) =>
        parseValidated(
          await callGemini(key, PRD_SYSTEM_PROMPT, messages, signal),
          validatePrdResponse,
          'PRD response',
        ),
    })
  }

  let result: any
  try {
    result = await runChain(attempts, new Deadline(TOTAL_BUDGET_MS), 'areep-prd')
  } catch (error) {
    console.warn(
      `[areep-prd] all providers failed for project ${projectId ?? '(unknown)'}:`,
      error instanceof Error ? error.message : String(error),
    )
    return jsonResponse({ error: 'prd_failed', message: GENERIC_ERROR_MESSAGE }, 502, origin)
  }

  /* version/generated_at/project_slug are never trusted verbatim from the
     model — the slug becomes a downloaded filename, and the date and
     version are facts about this generation, not the model's opinion. */
  result.metadata = {
    project_name: (result.metadata?.project_name || projectName || 'مشروع بدون اسم').toString(),
    project_slug: sanitizeProjectSlug(result.metadata?.project_slug),
    version: 'v1.0',
    generated_at: new Date().toISOString(),
  }

  return jsonResponse(result, 200, origin)
})
