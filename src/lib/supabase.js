import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Both values are intentionally public (see .env.example) — the anon key is
// safe to ship to the browser, RLS in supabase/schema.sql is the real
// security boundary. Until the Supabase project exists, these will be
// empty strings; every consumer of this module must handle that instead
// of assuming `supabase` is always a usable client.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
