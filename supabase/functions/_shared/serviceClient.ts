/* ============================================================
   The service-role REST/RPC client every Edge Function that needs to read
   or write across RLS boundaries shares — extracted out of adminAuth.ts
   so a non-admin-gated function (discovery, prd, get-my-usage) can pull
   in a plain `rpc()` helper without importing a file named "admin"
   anything for it.
   ============================================================ */

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
export const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/** One round-trip to Postgres through PostgREST's RPC endpoint, under the service role. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
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

/** One round-trip to PostgREST's table endpoint, under the service role. Read-only helper. */
export async function selectOne<T>(table: string, filter: string, select: string): Promise<T | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=${select}&limit=1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!response.ok) return null
  const rows = (await response.json()) as T[]
  return rows[0] ?? null
}
