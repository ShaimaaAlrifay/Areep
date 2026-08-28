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
export async function updateProjectDiscovery(projectId, { confidence, discovery_state }) {
  return supabase.from('projects').update({ confidence, discovery_state }).eq('id', projectId)
}
