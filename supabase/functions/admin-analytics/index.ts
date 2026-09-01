/* ============================================================
   Owner-only analytics. The single place that may read across all users.

   Why this exists as a function rather than as client queries: RLS scopes
   every table to the caller's own organisation, which is correct and must
   stay that way. An owner dashboard needs the opposite — totals across
   everyone — so it runs here, under the service role, behind two gates:

     1. verify_jwt (platform): the caller presented a credential this
        project accepts.
     2. app_admins.is_super_admin: the caller is a specific human we
        marked. The publishable key passes gate 1 — it is public and
        shipped in the bundle — so gate 2 is the one that actually matters.

   Nothing that identifies a person leaves this function. Every response
   field is a count, a rate, a bucket or a timestamp. There are no emails,
   no names, no project titles, no message text. That is a deliberate
   privacy boundary, not an oversight: the owner needs to know how the
   product behaves, not what any individual customer wrote.

   Metrics that cannot be computed from real data are ABSENT from the
   response rather than zero. The client renders absence as "not tracked",
   never as a number, so the dashboard can never imply a measurement that
   was not taken.
   ============================================================ */
import { corsHeaders, handleOptions } from '../_shared/cors.ts'
import { authenticatedUser } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

/** One round-trip to Postgres through PostgREST's RPC endpoint. */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(args),
  })
  if (!response.ok) throw new Error(`${fn}: ${response.status} ${await response.text()}`)
  return (await response.json()) as T
}

async function isSuperAdmin(userId: string): Promise<boolean> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/app_admins?user_id=eq.${userId}&select=is_super_admin`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  )
  if (!response.ok) return false
  const rows = (await response.json()) as { is_super_admin: boolean }[]
  return rows.length > 0 && rows[0].is_super_admin === true
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const preflight = handleOptions(req, origin)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'not_configured', message: 'الدالة غير مهيأة.' }, 500, origin)
  }

  const user = authenticatedUser(req)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401, origin)

  /* 403, and deliberately no hint about what would grant access. A
     signed-in non-owner learns only that this is not for them. */
  if (!(await isSuperAdmin(user.sub))) {
    return jsonResponse({ error: 'forbidden' }, 403, origin)
  }

  let body: { from?: string; to?: string; compareFrom?: string; compareTo?: string; probe?: boolean }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400, origin)
  }

  /* The route guard asks "am I an owner?" without asking for any data.
     Reaching this line already means yes — the check above ran — so the
     probe is just an early return that costs one small SELECT instead of
     the whole analytics query. It exists so the client can decide what to
     render before it knows which date range the owner wants. */
  if (body.probe === true) return jsonResponse({ ok: true }, 200, origin)

  const { from, to, compareFrom, compareTo } = body
  if (!from || !to) return jsonResponse({ error: 'invalid_request', message: 'from/to required' }, 400, origin)

  try {
    const payload = await rpc<unknown>('admin_analytics', {
      p_from: from,
      p_to: to,
      p_compare_from: compareFrom ?? null,
      p_compare_to: compareTo ?? null,
    })
    return jsonResponse(payload, 200, origin)
  } catch (error) {
    console.warn('[admin-analytics]', error instanceof Error ? error.message : String(error))
    return jsonResponse({ error: 'query_failed', message: 'تعذّر حساب المؤشرات.' }, 502, origin)
  }
})
