/* ============================================================
   Provider chain with a hard time budget.

   This replaces server/lib/jsonUtils.js's `withRetries`, and the change is
   deliberate rather than cosmetic.

   The Express version ran, worst case: 2 attempts x 2 Gemini keys, a 2s
   sleep, then 2 Groq attempts and another 2s sleep — up to SIX sequential
   LLM calls plus 4s of sleeping. On Supabase's Free plan an Edge Function
   is killed at 150s of wall clock and the caller gets a 504, so that chain
   could burn the user's PRD generation entirely and return nothing.

   What replaces it:

   - One flat, ordered list of attempts instead of nested retry loops. A
     malformed or off-shape response from one candidate simply falls
     through to the next, which IS the retry — just against a different key
     or a different model, which is strictly more likely to succeed than
     asking the same endpoint the same thing again.
   - No sleeps. The original backoff existed between retries of the same
     endpoint; moving to a different key or provider gains nothing from
     waiting, and on a 150s budget 4s is real money.
   - A per-call AbortSignal timeout, so one hung provider cannot eat the
     whole budget.
   - A global deadline checked before each attempt: a candidate is only
     started if there is plausibly time left to finish it. Better to return
     the previous error honestly than to be killed mid-flight at 150s.

   Net effect: worst case falls from six calls plus sleeps to three calls
   inside a bounded budget.
   ============================================================ */
import type { ProviderResult, ProviderUsage } from './providers/gemini.ts'

export interface Attempt<T> {
  /** Shown in logs only — never returned to the client. */
  readonly label: string
  /** Milliseconds this attempt is allowed before its signal aborts. */
  readonly timeoutMs: number
  readonly run: (signal: AbortSignal) => Promise<T>
}

export class Deadline {
  readonly #endsAt: number

  constructor(budgetMs: number) {
    this.#endsAt = Date.now() + budgetMs
  }

  remainingMs(): number {
    return Math.max(0, this.#endsAt - Date.now())
  }
}

/**
 * Runs `attempts` in order until one resolves, and returns its value.
 *
 * Throws the last error if every candidate fails or the budget runs out.
 * Individual failures are logged (they are operational detail: which key
 * hit its quota, which model returned unparseable JSON) but never
 * surfaced to the caller, matching the original routes' rule of never
 * leaking a provider error to the client.
 */
/* Called once per attempt that actually ran. Every provider call in the
   product passes through this function, so instrumenting here — rather
   than in each handler — is what keeps the telemetry from drifting out of
   sync with the chain it is supposed to describe. The callback is
   deliberately synchronous and its errors are swallowed: observing a call
   must never be able to fail it. */
export interface AttemptOutcome {
  label: string
  /** Position in the chain: 0 is the primary, above that is a fallback. */
  index: number
  ok: boolean
  durationMs: number
  error?: string
}

export async function runChain<T>(
  attempts: Attempt<T>[],
  deadline: Deadline,
  tag: string,
  onAttempt?: (outcome: AttemptOutcome) => void,
): Promise<T> {
  let lastError: unknown = new Error('no attempts were configured')

  const observe = (outcome: AttemptOutcome) => {
    if (!onAttempt) return
    try {
      onAttempt(outcome)
    } catch (error) {
      console.warn(`[${tag}] attempt observer threw:`, error instanceof Error ? error.message : String(error))
    }
  }

  /* Counts only attempts that RAN. A candidate skipped for lack of budget
     never touched a provider, so counting it would report a fallback that
     did not happen. */
  let index = 0

  for (const attempt of attempts) {
    const remaining = deadline.remainingMs()

    /* Skipping rather than starting-and-being-killed. A call begun with
       less budget than it needs cannot finish, and starting it would only
       trade a useful error for a platform 504. */
    if (remaining < attempt.timeoutMs) {
      console.warn(`[${tag}] skipping ${attempt.label}: ${remaining}ms budget left, needs ${attempt.timeoutMs}ms`)
      continue
    }

    const startedAt = Date.now()
    try {
      const value = await attempt.run(AbortSignal.timeout(attempt.timeoutMs))
      observe({ label: attempt.label, index, ok: true, durationMs: Date.now() - startedAt })
      return value
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      observe({ label: attempt.label, index, ok: false, durationMs: Date.now() - startedAt, error: message })
      console.warn(`[${tag}] ${attempt.label} failed:`, message)
    }
    index += 1
  }

  throw lastError
}

/**
 * Wraps one provider call + shape validation, and reports the token usage
 * and model of an attempt that actually produced a valid parsed result —
 * via `onSuccess`, not a return value, because only the attempt that
 * `runChain` ultimately keeps (the first one that does not throw) should
 * ever be treated as "the" usage for this request. A malformed response
 * still consumed the provider's own tokens, but this product's quota
 * tracking deliberately only meters the attempt that actually served the
 * user, which is the same simplification `ai_events` itself has always
 * made for cost/latency (see recordAiEvent's callers).
 */
export async function runProviderAttempt<T>(
  call: (signal: AbortSignal) => Promise<ProviderResult>,
  model: string,
  validate: (value: unknown) => boolean,
  what: string,
  signal: AbortSignal,
  onSuccess: (usage: ProviderUsage | null, model: string) => void,
): Promise<T> {
  const result = await call(signal)
  const parsed = parseValidated<T>(result.text, validate, what)
  onSuccess(result.usage, model)
  return parsed
}

/** Strips ```json ... ``` fences models sometimes wrap JSON output in. */
export function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/**
 * Parses and shape-validates a raw model response in one step, so every
 * caller fails the same way on malformed output and the chain can move on.
 */
export function parseValidated<T>(raw: string, isValid: (value: unknown) => boolean, what: string): T {
  const candidate = JSON.parse(stripJsonFences(raw))
  if (!isValid(candidate)) throw new Error(`${what} failed shape validation`)
  return candidate as T
}
