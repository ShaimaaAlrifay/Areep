import { supabase } from '../lib/supabase'

/**
 * Thin data-access layer over the `messages` table (see the "messages"
 * section appended to supabase/schema.sql). That migration has to be run
 * manually by whoever owns the Supabase project — until it is, every call
 * here fails with "relation does not exist" (Postgres 42P01) or
 * PostgREST's schema-cache miss (PGRST205). Callers should treat that as a
 * soft "not set up yet" signal, not a crash: see `isMissingTableError`.
 */
export function isMissingTableError(error) {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase()
  return message.includes('does not exist') || message.includes('schema cache')
}

export async function listMessages(projectId) {
  return supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
}

export async function insertMessage(projectId, role, content) {
  return supabase.from('messages').insert({ project_id: projectId, role, content }).select('id, role, content, created_at').single()
}
