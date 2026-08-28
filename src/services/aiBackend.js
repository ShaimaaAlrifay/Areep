/* ============================================================
   One transport for both AI endpoints (discovery + PRD).

   These used to be two copies of the same fetch-to-Express block. They now
   call Supabase Edge Functions, which is what moves the Gemini and Groq
   keys into Supabase Secrets: the browser never sees a provider key, and
   the platform rejects any caller without a valid Supabase Auth JWT before
   the function — and therefore before any key — is reached. As an Express
   route, /api/discovery was open to anyone who knew the URL.

   supabase.functions.invoke attaches the signed-in user's access token
   automatically, so there is no token plumbing here.

   VITE_AREEP_API_URL is the escape hatch. Setting it routes both endpoints
   back to the old `npm run server` backend, unchanged. It exists so the
   switchover is reversible without a code change or a redeploy, and so
   local work against server/ still functions while it is still there. It
   is deliberately opt-in: unset — which is what production should be —
   means Edge Functions.
   ============================================================ */
import { supabase } from '../lib/supabase'

const LEGACY_API_BASE = (import.meta.env.VITE_AREEP_API_URL || '').trim()

export const usingLegacyBackend = Boolean(LEGACY_API_BASE)

const NOT_CONFIGURED_MESSAGE = 'قاعدة البيانات غير مهيأة بعد. أضف بيانات الاتصال بـ Supabase أولاً.'

/**
 * Calls one of the AI endpoints and normalises every possible outcome into
 * `{ data, error }`, where `error` is always a finished Arabic sentence
 * safe to render. No caller should ever see an exception, an HTTP status,
 * or a provider's own error text.
 *
 * @param {'discovery'|'prd'} name  Edge Function name; also the legacy path segment.
 * @param {object} body
 * @param {{network: string, generic: string}} messages  Endpoint-specific copy.
 */
export async function callAiBackend(name, body, messages) {
  if (usingLegacyBackend) return callLegacy(name, body, messages)

  if (!supabase) return { data: null, error: NOT_CONFIGURED_MESSAGE }

  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    /* A non-2xx from the function arrives as an error carrying the original
       Response on `context`. The function's own Arabic message lives in
       that body — reading it is what keeps "لا توجد متطلبات كافية" from
       being flattened into a generic failure. */
    const detail = await readFunctionError(error)
    return { data: null, error: detail || messages.network }
  }

  if (!data) return { data: null, error: messages.generic }
  return { data, error: null }
}

async function readFunctionError(error) {
  try {
    const body = await error?.context?.json?.()
    return typeof body?.message === 'string' ? body.message : null
  } catch {
    /* Not an HTTP error (a genuine network failure, or a CORS rejection),
       or a body that isn't JSON. Either way the caller's network copy is
       the honest thing to show. */
    return null
  }
}

/** The pre-migration path, kept byte-compatible with server/routes/*.js. */
async function callLegacy(name, body, messages) {
  let response
  try {
    response = await fetch(`${LEGACY_API_BASE}/api/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { data: null, error: messages.network }
  }

  const parsed = await response.json().catch(() => null)
  if (!response.ok) return { data: null, error: parsed?.message || messages.generic }
  if (!parsed) return { data: null, error: messages.generic }
  return { data: parsed, error: null }
}
