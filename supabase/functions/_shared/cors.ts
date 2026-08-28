/* ============================================================
   CORS, replacing the `cors` npm package that server/index.js used.

   The browser calls these functions from a different origin than they are
   served from (areep.netlify.app -> <ref>.supabase.co), so every response
   — including the preflight — needs these headers or the browser discards
   the result before the app ever sees it.

   `authorization` in the allowed headers is the one that is easy to miss:
   supabase.functions.invoke attaches the user's JWT there, and a preflight
   that does not permit it fails with a CORS error that looks exactly like
   the function being down.

   The allowlist is explicit rather than `*`. These endpoints now run
   authenticated on the user's own token, and a wildcard would let any site
   a signed-in user visits invoke them with that token from the browser.
   ============================================================ */

const ALLOWED_ORIGINS = [
  'https://areep.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

/**
 * Netlify deploy previews and branch deploys get their own subdomains
 * (deploy-preview-3--areep.netlify.app, main--areep.netlify.app), which
 * would otherwise all be blocked. Matched by pattern rather than listed.
 */
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+--areep\.netlify\.app$/

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN_PATTERN.test(origin)) ? origin : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    /* Responses differ per origin, so a shared cache must not serve one
       origin's Allow-Origin header to another. */
    Vary: 'Origin',
  }
}

export function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

/** Answers the preflight. Returns null when the request is not a preflight. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}
