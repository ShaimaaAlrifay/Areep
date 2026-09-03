/* ============================================================
   Records one attempt against a model provider into `ai_events`.

   Three rules this file exists to enforce:

   1. IT MUST NEVER AFFECT THE RESPONSE. Telemetry that can fail a user's
      request is worse than no telemetry. Every write is fire-and-forget
      and every error is swallowed — a broken analytics table must not
      turn a working discovery turn into an error the user sees.

   2. IT MUST NOT DELAY THE RESPONSE. The insert is not awaited by the
      handler; it is handed to the platform's background waiter so the
      function may return while the row is still being written.

   3. NULL IS NOT ZERO. Token counts are only set when the provider
      actually reported them. A failed call, or a provider that omits
      usage, stores null — so the dashboard can say "not reported"
      instead of quietly averaging in a zero that never happened.
   ============================================================ */

export interface AiEvent {
  kind: 'discovery' | 'prd' | 'regeneration'
  provider: string
  /** Position in the provider chain: 0 is primary, anything above is a fallback. */
  attempt: number
  ok: boolean
  durationMs?: number
  inputTokens?: number | null
  outputTokens?: number | null
  /** Which model actually answered — Gemini and Groq have one each today, but this is a fact of the call, not an assumption. */
  model?: string | null
  /** Short machine code (QUOTA_EXCEEDED, AI_RATE_LIMITED, ...) — kept apart from the free-text `error` below. */
  errorCode?: string | null
  error?: string
  projectId?: string | null
  userId?: string | null
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/** Truncated so a provider returning an HTML error page cannot bloat a row. */
function trimError(error?: string): string | null {
  if (!error) return null
  return error.length > 400 ? `${error.slice(0, 400)}…` : error
}

async function insert(event: AiEvent): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return
  await fetch(`${SUPABASE_URL}/rest/v1/ai_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      kind: event.kind,
      provider: event.provider,
      attempt: event.attempt,
      ok: event.ok,
      duration_ms: event.durationMs ?? null,
      input_tokens: event.inputTokens ?? null,
      output_tokens: event.outputTokens ?? null,
      model: event.model ?? null,
      error_code: event.errorCode ?? null,
      error: trimError(event.error),
      project_id: event.projectId ?? null,
      user_id: event.userId ?? null,
    }),
  })
}

/** Derives the provider from a chain label like "gemini-key2" or
 *  "groq-fallback", so the dashboard groups by provider rather than by the
 *  key that happened to serve the call. */
export function providerFromLabel(label: string): string {
  return label.split('-')[0] || label
}

/**
 * Fire-and-forget. The insert is handed to the platform's background
 * waiter, so the function may return its response while the row is still
 * being written — the user never waits on telemetry.
 */
export function recordAiEvent(event: AiEvent): void {
  const task = insert(event).catch((error) => {
    // Deliberately terminal: telemetry never propagates to the caller.
    console.warn('[ai-events] insert failed:', error instanceof Error ? error.message : String(error))
  })
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(task)
}
