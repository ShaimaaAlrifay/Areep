/* ============================================================
   Base URL of the areep/server Express backend (discovery + PRD).

   Distinct from VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (Supabase talks
   directly to the browser) — this hits our own small Node proxy, which is
   what holds the Gemini/Groq API keys. It lives in its own module because
   both service clients need it, and two copies of a default URL is
   precisely the kind of thing that gets updated in one file only.

   The localhost default is right for `npm run dev`, and dangerous in
   production: a deployed frontend that never had VITE_AREEP_API_URL set
   would try to reach the developer's own machine, and every discovery
   message and PRD generation would fail with a network error that looks
   like the backend being down rather than a misconfiguration. The guard
   below turns that into an unmissable console error at load, instead of a
   mystery a user reports days later.
   ============================================================ */

const DEFAULT_LOCAL_API = 'http://localhost:3002'

export const API_BASE = import.meta.env.VITE_AREEP_API_URL || DEFAULT_LOCAL_API

/** Hostnames where pointing at a local backend is the correct behaviour. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', ''])

if (typeof window !== 'undefined') {
  const servedLocally = LOCAL_HOSTS.has(window.location.hostname)
  const apiIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(API_BASE)

  if (!servedLocally && apiIsLocal) {
    console.error(
      `[areep] VITE_AREEP_API_URL is not configured for this deployment.\n` +
        `  The app is served from ${window.location.origin} but will call ${API_BASE},\n` +
        `  which resolves to each visitor's own machine. Discovery and PRD generation will fail.\n` +
        `  Set VITE_AREEP_API_URL to the deployed backend's URL and rebuild.`,
    )
  }
}
