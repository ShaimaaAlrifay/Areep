import { supabase } from '../lib/supabase'
import { isMissingTableError } from './messagesService'

/**
 * Thin data-access layer over the `prd_feedback` table (see the "PRD
 * Feedback phase" section appended to supabase/schema.sql). Same
 * not-yet-migrated degradation story as requirementsService/
 * messagesService: until the migration is run, every call here fails
 * with Postgres 42P01 / PostgREST PGRST205 — `isMissingTableError`
 * (re-exported, same helper, no need to fork it) is how callers tell
 * that apart from a real error.
 */
export { isMissingTableError }

const COLUMNS =
  'id, project_id, sentiment, positive_reasons, negative_reasons, requirement_accuracy, requirement_completeness, edit_level, value_rating, rating, comment, submitted_at, created_at'

/** The signed-in user's own feedback row for this project, if any (RLS already scopes this to `user_id = auth.uid()`). */
export async function getMyPrdFeedback(projectId) {
  return supabase.from('prd_feedback').select(COLUMNS).eq('project_id', projectId).maybeSingle()
}

/**
 * Progressive-save write, used by every step of the feedback flow.
 * `onConflict: 'project_id'` is what makes "one feedback per PRD" true
 * by construction — every step updates the same row instead of a fresh
 * insert, and a second team member trying to feedback the same project's
 * PRD collides on this same constraint (see schema.sql's "Known edge
 * case" comment on the table — surfaced here as a distinct 'conflict'
 * error rather than a raw Postgres/RLS error reaching the UI).
 */
export async function savePrdFeedbackStep(projectId, userId, patch) {
  const { data, error } = await supabase
    .from('prd_feedback')
    .upsert({ project_id: projectId, user_id: userId, ...patch }, { onConflict: 'project_id' })
    .select(COLUMNS)
    .single()

  if (error) return { data: null, error: classifyError(error) }
  return { data, error: null }
}

/** Same progressive upsert, but stamps `submitted_at` — the moment a draft becomes a completed submission. */
export async function submitPrdFeedback(projectId, userId, patch) {
  return savePrdFeedbackStep(projectId, userId, { ...patch, submitted_at: new Date().toISOString() })
}

function classifyError(error) {
  if (isMissingTableError(error)) return { kind: 'missing_table', raw: error }
  // RLS rejects an upsert whose ON CONFLICT branch would UPDATE a row
  // this user doesn't own (someone else on the team already gave
  // feedback for this project) with a permission-denied style failure.
  if (error.code === '42501' || /permission denied|row-level security/i.test(error.message || '')) {
    return { kind: 'conflict', raw: error }
  }
  return { kind: 'unknown', raw: error }
}
