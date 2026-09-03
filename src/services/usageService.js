// Thin client for get-my-usage, the same shape every other client/*.js
// file in this app follows (src/admin/settings/client.js, analytics/client.js):
// nothing above this file knows Supabase exists or what get_my_usage()'s
// jsonb shape looks like — it just consumes the already-computed numbers.
import { supabase } from '../lib/supabase'

export async function fetchMyUsage() {
  if (!supabase) return { data: null, error: 'not_configured' }
  const { data, error } = await supabase.functions.invoke('get-my-usage', { body: {} })
  if (error) return { data: null, error: 'unavailable' }
  return { data, error: null }
}
