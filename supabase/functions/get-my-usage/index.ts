/* ============================================================
   POST /functions/v1/get-my-usage
   Body: {} (nothing — the caller is always themselves)

   Backs the sidebar usage indicator. No admin gate: authenticatedUser()
   is enough, because the id it passes to get_my_usage() is always the
   caller's own — taken from their verified JWT, never anything the
   client could send to look at someone else's usage.

   The shape returned is already the one the frontend renders — tokens
   used/limit, a percentage, remaining tokens, today's requests against
   the daily cap, and a status band — so src/services/usageService.js
   stays a pure passthrough, the same "compute the shape server-side"
   rule every other client/*.js file in this app already follows.
   ============================================================ */
import { jsonResponse, handlePreflight } from '../_shared/cors.ts'
import { authenticatedUser } from '../_shared/auth.ts'
import { SUPABASE_URL, SERVICE_KEY, rpc } from '../_shared/serviceClient.ts'

interface RawUsage {
  tokensUsed: number
  tokensLimit: number
  requestsToday: number
  dailyRequestLimit: number
  prdGenerationsUsed: number
  prdGenerationsLimit: number
}

/* Same bands as the spec: quiet until 70%, a status string the frontend
   decides how (and whether) to show rather than this function dictating
   UI. */
function statusFor(percentage: number): string {
  if (percentage >= 100) return 'limit_reached'
  if (percentage >= 95) return 'critical'
  if (percentage >= 85) return 'near_limit'
  if (percentage >= 70) return 'warning'
  return 'healthy'
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'not_configured' }, 500, origin)
  }

  const user = authenticatedUser(req)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401, origin)

  try {
    const usage = await rpc<RawUsage>('get_my_usage', { p_user_id: user.sub })
    const percentage = usage.tokensLimit > 0 ? (usage.tokensUsed / usage.tokensLimit) * 100 : 0

    return jsonResponse(
      {
        tokensUsed: usage.tokensUsed,
        tokensLimit: usage.tokensLimit,
        usagePercentage: Math.round(percentage * 10) / 10,
        remainingTokens: Math.max(0, usage.tokensLimit - usage.tokensUsed),
        requestsToday: usage.requestsToday,
        dailyRequestLimit: usage.dailyRequestLimit,
        prdGenerationsUsed: usage.prdGenerationsUsed,
        prdGenerationsLimit: usage.prdGenerationsLimit,
        status: statusFor(percentage),
      },
      200,
      origin,
    )
  } catch (error) {
    console.warn('[get-my-usage]', error instanceof Error ? error.message : String(error))
    return jsonResponse({ error: 'query_failed' }, 502, origin)
  }
})
