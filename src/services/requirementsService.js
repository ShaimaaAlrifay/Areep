import { supabase } from '../lib/supabase'
import { isMissingTableError } from './messagesService'
import { REQUIREMENT_TYPE_PREFIX } from '../lib/constants'

/**
 * Thin data-access + merge layer over the `requirements` table (see the
 * "Requirements engine" section appended to supabase/schema.sql). Same
 * not-yet-migrated degradation story as messagesService: until the
 * migration is run, every call here fails with Postgres 42P01 / PostgREST
 * PGRST205 ("relation/table does not exist") — `isMissingTableError`
 * (imported from messagesService, same helper, no need to fork it) is how
 * callers tell that apart from a real error.
 */
export { isMissingTableError }

const SELECT_COLUMNS = 'id, project_id, req_key, type, title, description, priority, status, source, created_at, updated_at'

/** All active requirements for a project, oldest-first (stable display order within a section). */
export async function listRequirements(projectId) {
  return supabase
    .from('requirements')
    .select(SELECT_COLUMNS)
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
}

/**
 * Merge engine (spec section 9): folds one discovery turn's
 * `requirements_extracted` into the normalized table, matched by
 * `(project_id, req_key)`:
 *  - no existing row → inserted fresh, source 'ai'.
 *  - existing row, source 'ai' → title/description/priority/type refreshed
 *    to the AI's latest values (the AI re-emits its full running list every
 *    turn, so this keeps the row in sync with the conversation).
 *  - existing row, source 'user' → left completely untouched. A human
 *    edited or manually added it; the next AI turn must never silently
 *    clobber that, so it's excluded from the upsert payload entirely.
 *
 * Best-effort: on a not-yet-migrated `requirements` table this logs and
 * returns without throwing — `projects.discovery_state` (written
 * separately, unconditionally, by the caller) is still the fallback the
 * Review UI reads from in that case.
 */
export async function mergeDiscoveryRequirements(projectId, extracted) {
  const items = Array.isArray(extracted) ? extracted.filter((item) => item && typeof item.id === 'string' && item.id.trim()) : []
  if (items.length === 0) return { skipped: 0, upserted: 0, error: null }

  const { data: existing, error: fetchError } = await supabase
    .from('requirements')
    .select('req_key, source')
    .eq('project_id', projectId)
    .eq('status', 'active')

  if (fetchError) {
    if (isMissingTableError(fetchError)) {
      console.warn('[areep] requirements table not migrated yet — skipping normalized merge for this turn.')
      return { skipped: items.length, upserted: 0, error: null }
    }
    console.warn('[areep] could not read existing requirements for merge:', fetchError.message)
    return { skipped: 0, upserted: 0, error: fetchError }
  }

  const sourceByKey = new Map((existing || []).map((row) => [row.req_key, row.source]))

  let skipped = 0
  const payload = []
  for (const item of items) {
    const reqKey = item.id.trim()
    const existingSource = sourceByKey.get(reqKey)
    if (existingSource === 'user') {
      skipped += 1
      continue
    }
    payload.push({
      project_id: projectId,
      req_key: reqKey,
      type: item.type,
      title: item.title,
      description: item.description || null,
      priority: item.priority || 'Unspecified',
      status: 'active',
      source: 'ai',
    })
  }

  if (skipped > 0) {
    console.info(`[areep] requirements merge: skipped ${skipped} user-edited row(s) — kept the human's version.`)
  }
  if (payload.length === 0) return { skipped, upserted: 0, error: null }

  const { error: upsertError } = await supabase.from('requirements').upsert(payload, { onConflict: 'project_id,req_key' })

  if (upsertError) {
    if (isMissingTableError(upsertError)) {
      console.warn('[areep] requirements table not migrated yet — skipping normalized merge for this turn.')
      return { skipped: items.length, upserted: 0, error: null }
    }
    console.warn('[areep] requirements merge upsert failed:', upsertError.message)
    return { skipped, upserted: 0, error: upsertError }
  }

  return { skipped, upserted: payload.length, error: null }
}

/**
 * User-initiated edit (spec section 26 "Edit"). Always stamps
 * `source: 'user'` — per the merge rule above, this is what stops the next
 * AI turn from silently overwriting a human's correction.
 */
export async function updateRequirement(id, { title, description, priority }) {
  return supabase
    .from('requirements')
    .update({ title, description: description || null, priority, source: 'user' })
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .single()
}

/**
 * User-initiated delete (spec section 26 "Delete"). Hard delete, not a
 * soft `status: 'deleted'` flip — see the schema.sql comment above this
 * table for why: `status` is reserved for a future undo/versioning phase,
 * not used yet. Deleting a row that a later AI turn still mentions (the
 * AI has no memory of the deletion) means it can come back as a fresh
 * 'ai'-sourced row next turn — an accepted tradeoff of hard-delete over
 * soft-delete, documented here rather than silently discovered later.
 */
export async function deleteRequirement(id) {
  return supabase.from('requirements').delete().eq('id', id)
}

/**
 * Computes the next sequential req_key for a manually-added requirement
 * of a given type within a project (spec section 26 "Add") — queries the
 * current max suffix for that type's prefix and adds 1, rather than
 * guessing/hardcoding, so it never collides with AI-assigned keys.
 */
async function nextReqKey(projectId, type) {
  const prefix = REQUIREMENT_TYPE_PREFIX[type]
  const { data, error } = await supabase.from('requirements').select('req_key').eq('project_id', projectId).eq('type', type)

  if (error) return { reqKey: null, error }

  let maxSuffix = 0
  for (const row of data || []) {
    const match = /^[A-Z]+-(\d+)$/.exec(row.req_key || '')
    if (match) maxSuffix = Math.max(maxSuffix, Number.parseInt(match[1], 10))
  }
  const next = String(maxSuffix + 1).padStart(3, '0')
  return { reqKey: `${prefix}-${next}`, error: null }
}

/** Manually-added requirement (spec section 26 "Add"). Always `source: 'user'`. */
export async function addRequirement(projectId, { type, title, description, priority }) {
  const { reqKey, error: keyError } = await nextReqKey(projectId, type)
  if (keyError) return { data: null, error: keyError }

  return supabase
    .from('requirements')
    .insert({
      project_id: projectId,
      req_key: reqKey,
      type,
      title,
      description: description || null,
      priority: priority || 'Unspecified',
      status: 'active',
      source: 'user',
    })
    .select(SELECT_COLUMNS)
    .single()
}
