/* ============================================================
   Shared by every owner-only Edge Function (admin-analytics,
   admin-settings, and whatever gets added after these).

   The two gates every one of these functions needs, in one place instead
   of copy-pasted per function: verify_jwt (platform-level — a valid
   Supabase Auth JWT) plus `app_admins.is_super_admin` (application-level —
   THIS specific human). The publishable key passes the first gate on its
   own since it's public and shipped in the bundle, so the second one is
   what actually decides access. A signed-in non-owner gets a plain 403
   with no hint that anything exists behind it.
   ============================================================ */

import { SUPABASE_URL, SERVICE_KEY, rpc } from './serviceClient.ts'

export { SUPABASE_URL, SERVICE_KEY, rpc }

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_admins?user_id=eq.${userId}&select=is_super_admin`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!response.ok) return false
  const rows = (await response.json()) as { is_super_admin: boolean }[]
  return rows.length > 0 && rows[0].is_super_admin === true
}
