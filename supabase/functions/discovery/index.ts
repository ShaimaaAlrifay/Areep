/* ============================================================
   POST /functions/v1/discovery
   Body: { projectId, history: [{ role: 'user'|'assistant', content }] }

   Replaces server/routes/discovery.js. The request handling, the
   filtering of the history, the provider order and the error copy are all
   carried over unchanged. What is new is the time budget (see
   _shared/chain.ts) and the fact that the platform has already verified
   the caller's JWT before this runs — the endpoint is no longer open to
   anyone who knows the URL, which it was as an Express route.

   Gemini stays primary: it is the discovery persona the prompt is tuned
   for. Groq is a resilience fallback for that one turn — same prompt,
   same JSON contract, different model behind it. Not a role swap.

   As of the AI usage & quota phase, every call here is also gated by
   check_and_reserve_ai_usage() in Postgres before any provider is ever
   touched, and reconciled by finalize_ai_usage() once the chain settles —
   see _shared/quota.ts. Neither the request body nor the response is
   ever trusted for token counts; those come only from what the provider
   itself reports (_shared/providers/*.ts).
   ============================================================ */
import { Deadline, runChain, runProviderAttempt, type Attempt } from '../_shared/chain.ts'
import { providerFromLabel, recordAiEvent } from '../_shared/aiEvents.ts'
import { authenticatedUser } from '../_shared/auth.ts'
import { handlePreflight, jsonResponse } from '../_shared/cors.ts'
import { checkAndReserveQuota, errorResponseBody, estimateTokens, finalizeQuota } from '../_shared/quota.ts'
import { DISCOVERY_SYSTEM_PROMPT } from '../_shared/prompts/discovery.ts'
import { callGemini, geminiKeys, GEMINI_MODEL, ProviderError, type ChatMessage, type ProviderUsage } from '../_shared/providers/gemini.ts'
import { callGroq, groqKey, GROQ_MODEL } from '../_shared/providers/groq.ts'
import { validateDiscoveryResponse } from '../_shared/validateDiscoveryResponse.ts'

/* Spec section 48's exact copy — never leak a provider error to the client. */
const GENERIC_ERROR_MESSAGE = 'ما قدرت أحلل الإجابة حالياً. حاول مرة ثانية.'

/* The Free plan kills a function at 150s of wall clock. 110s leaves room
   for a cold start and the response trip, so we fail with a real message
   instead of being cut off into a 504. */
const TOTAL_BUDGET_MS = 110_000
/* Discovery turns are short (one reply plus extracted requirements), so a
   call still running after 30s is stuck rather than slow. */
const CALL_TIMEOUT_MS = 30_000

/* A protective cap, not a redesign of the discovery conversation model
   (spec section 13 asks for real context/state optimization, which is a
   separate, riskier project of its own). This just stops an unbounded
   history from silently becoming the dominant cost of a discovery turn —
   the most recent messages are what the model actually needs to keep the
   conversation coherent. */
const MAX_HISTORY_MESSAGES = 24

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

  let body: { projectId?: string; history?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_request', message: 'صيغة الطلب غير صحيحة.' }, 400, origin)
  }

  const { projectId, history } = body
  const projectIdOrNull = typeof projectId === 'string' ? projectId : null

  const messages: ChatMessage[] = Array.isArray(history)
    ? (history as ChatMessage[])
        .filter(
          (entry) =>
            entry &&
            typeof entry.content === 'string' &&
            entry.content.trim() &&
            (entry.role === 'user' || entry.role === 'assistant'),
        )
        .map((entry) => ({ role: entry.role, content: entry.content }))
        .slice(-MAX_HISTORY_MESSAGES)
    : []

  if (messages.length === 0) {
    return jsonResponse({ error: 'invalid_request', message: 'المحادثة فارغة.' }, 400, origin)
  }

  const decision = await checkAndReserveQuota(user.sub, 'discovery', projectIdOrNull)
  if (!decision.allowed) {
    const { status, body: errorBody } = errorResponseBody(decision.reason)
    return jsonResponse(errorBody, status, origin)
  }

  /* The size guard runs after reservation rather than before: the
     reservation ceiling (maxTokensPerRequest) is itself computed by the
     database, so this is the earliest point the Edge Function actually
     knows the number to guard against. The reservation is released
     immediately if this rejects — no provider is ever called either way. */
  const promptEstimate = estimateTokens(DISCOVERY_SYSTEM_PROMPT) + estimateTokens(JSON.stringify(messages))
  if (promptEstimate > decision.limits.maxTokensPerRequest) {
    await finalizeQuota(user.sub, decision.reservedTokens, 0)
    const { status, body: errorBody } = errorResponseBody('REQUEST_TOO_LARGE')
    return jsonResponse(errorBody, status, origin)
  }

  const captured: { usage: ProviderUsage | null; model: string | null } = { usage: null, model: null }
  const captureUsage = (usage: ProviderUsage | null, model: string) => {
    captured.usage = usage
    captured.model = model
  }

  /* One flat chain instead of nested retries. Each Gemini key is its own
     candidate so a per-key quota error moves straight on rather than
     hiding inside a provider-level loop with its own clock. */
  const attempts: Attempt<unknown>[] = [
    ...geminiKeys().map((key, i) => ({
      label: `gemini-key${i + 1}`,
      timeoutMs: CALL_TIMEOUT_MS,
      run: (signal: AbortSignal) =>
        runProviderAttempt(
          (s) => callGemini(key, DISCOVERY_SYSTEM_PROMPT, messages, s),
          GEMINI_MODEL,
          validateDiscoveryResponse,
          'Discovery response',
          signal,
          captureUsage,
        ),
    })),
  ]

  const groq = groqKey()
  if (groq) {
    attempts.push({
      label: 'groq-fallback',
      timeoutMs: CALL_TIMEOUT_MS,
      run: (signal: AbortSignal) =>
        runProviderAttempt(
          (s) => callGroq(groq, DISCOVERY_SYSTEM_PROMPT, messages, s),
          GROQ_MODEL,
          validateDiscoveryResponse,
          'Discovery response',
          signal,
          captureUsage,
        ),
    })
  }

  try {
    const parsed = await runChain(attempts, new Deadline(TOTAL_BUDGET_MS), 'areep-discovery', (outcome) =>
      recordAiEvent({
        kind: 'discovery',
        provider: providerFromLabel(outcome.label),
        attempt: outcome.index,
        ok: outcome.ok,
        durationMs: outcome.durationMs,
        inputTokens: outcome.ok ? captured.usage?.promptTokens ?? null : null,
        outputTokens: outcome.ok ? captured.usage?.outputTokens ?? null : null,
        model: outcome.ok ? captured.model : null,
        error: outcome.error,
        projectId: projectIdOrNull,
        userId: user.sub,
      }),
    )

    /* A provider that omits usage metadata leaves the real cost unknown —
       charging the full reservation in that case (rather than 0) is the
       conservative choice that cannot be exploited to bypass quota. */
    const usage = captured.usage
    const actualTokens = usage ? (usage.promptTokens ?? 0) + (usage.outputTokens ?? 0) : decision.reservedTokens
    await finalizeQuota(user.sub, decision.reservedTokens, actualTokens)

    return jsonResponse(parsed, 200, origin)
  } catch (error) {
    await finalizeQuota(user.sub, decision.reservedTokens, 0)
    console.warn(
      `[areep-discovery] all providers failed for project ${projectId ?? '(unknown)'}:`,
      error instanceof Error ? error.message : String(error),
    )
    if (error instanceof ProviderError && error.status === 429) {
      const { status, body: errorBody } = errorResponseBody('AI_RATE_LIMITED')
      return jsonResponse(errorBody, status, origin)
    }
    return jsonResponse({ error: 'discovery_failed', message: GENERIC_ERROR_MESSAGE }, 502, origin)
  }
})
