import { supabase } from '../lib/supabase'

/**
 * Thin data-access layer over the `projects`/`clients` tables. No business
 * logic here beyond the find-or-create-client convenience — orchestration
 * (e.g. the new-project chat wizard) lives in features/projects/.
 */

/** All of the signed-in org's projects, most-recently-updated first. */
export async function listProjects(organizationId) {
  return supabase
    .from('projects')
    .select('id, name, project_type, description, status, discovery_progress, confidence, discovery_state, client_id, created_at, updated_at, clients ( name )')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
}

/** A single project, scoped to the org so a stray/foreign id can't leak through. */
export async function getProject(projectId, organizationId) {
  return supabase
    .from('projects')
    .select('id, name, project_type, description, status, discovery_progress, confidence, discovery_state, client_id, created_at, updated_at, clients ( name )')
    .eq('id', projectId)
    .eq('organization_id', organizationId)
    .maybeSingle()
}

/** Reuses an existing client by exact name within the org, or creates one. */
export async function findOrCreateClient(organizationId, name) {
  const trimmed = name.trim()
  if (!trimmed) return { data: null, error: null }

  const { data: existing, error: findError } = await supabase
    .from('clients')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', trimmed)
    .maybeSingle()

  if (findError) return { data: null, error: findError }
  if (existing) return { data: existing, error: null }

  return supabase.from('clients').insert({ organization_id: organizationId, name: trimmed }).select('id').single()
}

export async function insertProject({ organizationId, clientId, name, projectType, description }) {
  return supabase
    .from('projects')
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      name,
      project_type: projectType,
      description: description || null,
    })
    .select('id, name, project_type, description, status, discovery_progress, client_id, created_at, updated_at')
    .single()
}

/**
 * Persists the latest discovery turn's confidence score + full running
 * snapshot (requirements_extracted / missing_information / contradictions
 * / discovery_status) onto the project row — see the "Discovery phase"
 * migration appended to supabase/schema.sql. Best-effort: on a
 * not-yet-migrated project (columns don't exist), Postgres returns error
 * 42703 ("column does not exist") here — callers should log and move on,
 * same degrade-gracefully spirit as messagesService's isMissingTableError,
 * not treat it as fatal.
 */
export async function updateProjectDiscovery(projectId, { confidence, discovery_state, status }) {
  const result = await supabase.from('projects').update({ confidence, discovery_state }).eq('id', projectId)

  // The status promotion is a SEPARATE statement on purpose, for two
  // independent reasons:
  //  - `.eq('status', 'discovery')` makes it a one-way promotion. A project
  //    that already reached 'prd_generated' must not be dragged back to
  //    'ready_for_review' just because the user kept chatting afterwards,
  //    and a filtered update is the only way to express that without a
  //    read-then-write race.
  //  - bundling it into the statement above would mean a row that doesn't
  //    match the status filter silently skips the confidence /
  //    discovery_state write too — losing the turn's real data to a guard
  //    that was only ever meant to protect one column.
  // Failure here is non-fatal: the snapshot above is what the UI actually
  // reads back, and the caller mirrors the new status locally regardless.
  if (status && !result.error) {
    const { error } = await supabase.from('projects').update({ status }).eq('id', projectId).eq('status', 'discovery')
    if (error) console.warn('[areep] could not advance project status:', error.message)
  }

  return result
}

// Confirmed live against the actual un-migrated `prd_data` column (see the
// "PRD generation phase" migration in supabase/schema.sql): a `select`
// fails with Postgres's own 42703 ("column ... does not exist"), but an
// `update` fails one layer up, in PostgREST's schema cache, with code
// PGRST204 and message "Could not find the 'prd_data' column of
// 'projects' in the schema cache" — which does NOT contain the phrase
// "does not exist", so checking only for that (an earlier version of this
// function did) silently missed the update path and the status-only
// fallback below never ran. Same two-shapes pattern as
// messagesService.js's isMissingTableError (42P01/"does not exist" vs
// PGRST205/"schema cache") — mirrored here for the same reason.
function isMissingPrdColumn(error) {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  const message = `${error.message || ''}`.toLowerCase()
  return message.includes('does not exist') || message.includes('schema cache')
}

/**
 * Persists a freshly generated PRD JSON onto the project row and flips
 * `status` to 'prd_generated' (spec sections 27-31) — see the "PRD
 * generation phase" migration appended to supabase/schema.sql. Best-effort,
 * same degrade-gracefully spirit as updateProjectDiscovery: on a
 * not-yet-migrated `prd_data` column, Postgres rejects the whole UPDATE
 * statement (42703, "column does not exist") — including the `status`
 * change bundled into the same call — so this falls back to updating
 * `status` alone in that case, so the ProjectTabs "PRD" pill still shows
 * up this session even though the document itself won't survive a reload
 * until the migration is run.
 */
export async function updateProjectPrd(projectId, prdData) {
  /* `prd_generated_at` is stamped here rather than derived later: it is the
     only moment the application knows a document was actually produced.
     `updated_at` cannot stand in for it — the touch trigger moves that on
     every write, so a rename would read as a generation. */
  const stampedAt = new Date().toISOString()
  const { error } = await supabase
    .from('projects')
    .update({ status: 'prd_generated', prd_data: prdData, prd_generated_at: stampedAt })
    .eq('id', projectId)
  if (error && isMissingPrdColumn(error)) {
    return supabase.from('projects').update({ status: 'prd_generated' }).eq('id', projectId)
  }
  return { error }
}

/**
 * Best-effort fetch of a project's persisted PRD JSON. Kept separate from
 * getProject/listProjects's shared SELECT_COLUMNS deliberately — folding
 * `prd_data` into that shared select would break EVERY project load (not
 * just the PRD preview page) on a database where the migration above
 * hasn't been run yet, since PostgREST fails the whole select on one
 * unknown column. This call is allowed to fail on its own;
 * PrdPreview.jsx treats a missing column the same as "no PRD generated
 * yet" rather than a crash.
 */
export async function getProjectPrd(projectId) {
  return supabase.from('projects').select('status, prd_data').eq('id', projectId).maybeSingle()
}
