/* ============================================================
   Read and change the global settings the dashboard exposes: project
   limits, AI usage/quota limits, and per-user overrides of the latter.
   Same two gates as admin-analytics (verify_jwt + app_admins.is_super_admin)
   — see that function's header for why the second gate is the one that
   matters.

   Split into its own function rather than folded into admin-analytics:
   that function only ever reads; this one writes, and keeping every
   write path behind one dedicated, small, easy-to-audit function is
   worth the extra actions living in the same file rather than spawning a
   new Edge Function per setting. The actual enforcement of every one of
   these limits does not live here — it lives in Postgres (the
   projects_enforce_limit trigger, and check_and_reserve_ai_usage() for
   the AI ceilings). This function only lets a Super Admin read and
   change the numbers those enforce.
   ============================================================ */
import { jsonResponse, handlePreflight } from '../_shared/cors.ts'
import { authenticatedUser } from '../_shared/auth.ts'
import { SUPABASE_URL, SERVICE_KEY, rpc, isSuperAdmin } from '../_shared/adminAuth.ts'

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'not_configured', message: 'الدالة غير مهيأة.' }, 500, origin)
  }

  const user = authenticatedUser(req)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401, origin)

  /* Same deliberate silence as admin-analytics: a signed-in non-owner
     learns only that this is not for them, not that a setting exists. */
  if (!(await isSuperAdmin(user.sub))) {
    return jsonResponse({ error: 'forbidden' }, 403, origin)
  }

  let body: {
    action?: string
    maxProjectsPerUser?: unknown
    tokensPerMonth?: unknown
    requestsPerDay?: unknown
    maxPrdGenerationsPerMonth?: unknown
    maxRegenerationsPerProject?: unknown
    maxTokensPerRequest?: unknown
    query?: unknown
    userId?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400, origin)
  }

  try {
    switch (body.action) {
      case 'set': {
        const value = body.maxProjectsPerUser
        // Validated here too, not just trusted to the SQL function's own
        // check — an integer arriving as e.g. "5" (string) or 5.5 should
        // fail with a clear reason before it ever reaches Postgres.
        if (!isPositiveInt(value)) {
          return jsonResponse({ error: 'invalid_limit', message: 'الحد يجب أن يكون رقمًا صحيحًا أكبر من صفر.' }, 400, origin)
        }
        const payload = await rpc<unknown>('admin_set_project_limit', { p_limit: value, p_admin_user_id: user.sub })
        return jsonResponse(payload, 200, origin)
      }

      case 'get_ai_limits': {
        const payload = await rpc<unknown>('admin_get_ai_limits', {})
        return jsonResponse(payload, 200, origin)
      }

      case 'set_ai_limits': {
        const fields = [
          body.tokensPerMonth,
          body.requestsPerDay,
          body.maxPrdGenerationsPerMonth,
          body.maxRegenerationsPerProject,
          body.maxTokensPerRequest,
        ]
        if (!fields.every(isPositiveInt)) {
          return jsonResponse({ error: 'invalid_limit', message: 'كل الحدود يجب أن تكون أرقامًا صحيحة أكبر من صفر.' }, 400, origin)
        }
        const payload = await rpc<unknown>('admin_set_ai_limits', {
          p_tokens_per_month: body.tokensPerMonth,
          p_requests_per_day: body.requestsPerDay,
          p_max_prd_generations_per_month: body.maxPrdGenerationsPerMonth,
          p_max_regenerations_per_project: body.maxRegenerationsPerProject,
          p_max_tokens_per_request: body.maxTokensPerRequest,
          p_admin_user_id: user.sub,
        })
        return jsonResponse(payload, 200, origin)
      }

      case 'lookup_user': {
        const query = typeof body.query === 'string' ? body.query.trim() : ''
        if (!query) {
          return jsonResponse({ error: 'invalid_request', message: 'أدخل بريدًا إلكترونيًا أو معرّف مستخدم.' }, 400, origin)
        }
        const payload = await rpc<unknown>('admin_lookup_user_usage', { p_query: query })
        return jsonResponse(payload, 200, origin)
      }

      case 'set_user_limits': {
        const targetUserId = typeof body.userId === 'string' ? body.userId : null
        if (!targetUserId) {
          return jsonResponse({ error: 'invalid_request' }, 400, origin)
        }
        // Per-user overrides are allowed to leave any single field unset
        // (falls through to the global default) — only the fields
        // actually present are validated, not required.
        const optionalPositiveInt = (value: unknown) => value === null || value === undefined || isPositiveInt(value)
        const fields = [
          body.tokensPerMonth,
          body.requestsPerDay,
          body.maxProjectsPerUser,
          body.maxPrdGenerationsPerMonth,
          body.maxRegenerationsPerProject,
          body.maxTokensPerRequest,
        ]
        if (!fields.every(optionalPositiveInt)) {
          return jsonResponse({ error: 'invalid_limit', message: 'كل حد مُدخل يجب أن يكون رقمًا صحيحًا أكبر من صفر.' }, 400, origin)
        }
        const payload = await rpc<unknown>('admin_set_user_limits', {
          p_user_id: targetUserId,
          p_tokens_per_month: body.tokensPerMonth ?? null,
          p_requests_per_day: body.requestsPerDay ?? null,
          p_max_projects_per_user: body.maxProjectsPerUser ?? null,
          p_max_prd_generations_per_month: body.maxPrdGenerationsPerMonth ?? null,
          p_max_regenerations_per_project: body.maxRegenerationsPerProject ?? null,
          p_max_tokens_per_request: body.maxTokensPerRequest ?? null,
          p_admin_user_id: user.sub,
        })
        return jsonResponse(payload, 200, origin)
      }

      case 'reset_user_limits': {
        const targetUserId = typeof body.userId === 'string' ? body.userId : null
        if (!targetUserId) {
          return jsonResponse({ error: 'invalid_request' }, 400, origin)
        }
        const payload = await rpc<unknown>('admin_reset_user_limits', { p_user_id: targetUserId })
        return jsonResponse(payload, 200, origin)
      }

      default: {
        // Covers both an explicit {action:'get'} and any other/missing
        // action, so a client that forgets to pass `action` still gets
        // the current project-limit status rather than a confusing error
        // — unchanged from before this function grew more actions.
        const payload = await rpc<unknown>('admin_project_limit_status', {})
        return jsonResponse(payload, 200, origin)
      }
    }
  } catch (error) {
    console.warn('[admin-settings]', error instanceof Error ? error.message : String(error))
    return jsonResponse({ error: 'query_failed', message: 'تعذّر تحديث أو قراءة الإعداد.' }, 502, origin)
  }
})
