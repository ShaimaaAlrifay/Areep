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
   ============================================================ */
import { Deadline, parseValidated, runChain, type Attempt } from '../_shared/chain.ts'
import { providerFromLabel, recordAiEvent } from '../_shared/aiEvents.ts'
import { authenticatedUser } from '../_shared/auth.ts'
import { handlePreflight, jsonResponse } from '../_shared/cors.ts'
import { DISCOVERY_SYSTEM_PROMPT } from '../_shared/prompts/discovery.ts'
import { callGemini, geminiKeys, type ChatMessage } from '../_shared/providers/gemini.ts'
import { callGroq, groqKey } from '../_shared/providers/groq.ts'
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
    : []

  if (messages.length === 0) {
    return jsonResponse({ error: 'invalid_request', message: 'المحادثة فارغة.' }, 400, origin)
  }

  /* One flat chain instead of nested retries. Each Gemini key is its own
     candidate so a per-key quota error moves straight on rather than
     hiding inside a provider-level loop with its own clock. */
  const attempts: Attempt<unknown>[] = [
    ...geminiKeys().map((key, i) => ({
      label: `gemini-key${i + 1}`,
      timeoutMs: CALL_TIMEOUT_MS,
      run: async (signal: AbortSignal) =>
        parseValidated(
          await callGemini(key, DISCOVERY_SYSTEM_PROMPT, messages, signal),
          validateDiscoveryResponse,
          'Discovery response',
        ),
    })),
  ]

  const groq = groqKey()
  if (groq) {
    attempts.push({
      label: 'groq-fallback',
      timeoutMs: CALL_TIMEOUT_MS,
      run: async (signal: AbortSignal) =>
        parseValidated(
          await callGroq(groq, DISCOVERY_SYSTEM_PROMPT, messages, signal),
          validateDiscoveryResponse,
          'Discovery response',
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
        error: outcome.error,
        projectId: typeof projectId === 'string' ? projectId : null,
        userId: user.sub,
      }),
    )
    return jsonResponse(parsed, 200, origin)
  } catch (error) {
    console.warn(
      `[areep-discovery] all providers failed for project ${projectId ?? '(unknown)'}:`,
      error instanceof Error ? error.message : String(error),
    )
    return jsonResponse({ error: 'discovery_failed', message: GENERIC_ERROR_MESSAGE }, 502, origin)
  }
})
