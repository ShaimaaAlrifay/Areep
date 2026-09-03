import { findOrCreateClient, insertProject } from '../../services/projectsService'

/**
 * Ported verbatim (same find-or-create-client-by-name, then insert-project
 * behavior) from the old ProjectNew.jsx form page, now driven by the
 * scripted new-project chat flow (see useNewProjectFlow.js) instead of a
 * form submit.
 */
export async function createProject({ organizationId, name, clientName, projectType, description }) {
  if (!organizationId) {
    throw new Error('تعذّر تحديد مساحة العمل الخاصة بك. حاول تحديث الصفحة.')
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('اسم المشروع مطلوب.')
  }

  let clientId = null
  const trimmedClient = (clientName || '').trim()
  if (trimmedClient) {
    const { data: client, error: clientError } = await findOrCreateClient(organizationId, trimmedClient)
    if (clientError) throw clientError
    clientId = client?.id ?? null
  }

  const { data: project, error: insertError } = await insertProject({
    organizationId,
    clientId,
    name: trimmedName,
    projectType: projectType || 'other',
    description: (description || '').trim(),
  })
  if (insertError) throw toFriendlyError(insertError)

  return project
}

/**
 * `enforce_project_limit()` (a BEFORE INSERT trigger in Postgres, not
 * anything in this file) is the actual gate — it runs no matter how the
 * insert reaches the table, including a request built by hand against
 * the REST API. What lands here is only that trigger's raised exception,
 * surfaced by PostgREST as `error.message === 'project_limit_reached'`
 * with the limit/current numbers JSON-encoded in `error.details`.
 *
 * Thrown as a plain Error carrying `.code === 'project_limit_reached'`
 * (not a custom class) so `useNewProjectFlow`'s catch block can tell it
 * apart from every other failure with a simple property check, and
 * render the dashboard's actual configured limit instead of a raw
 * Postgres exception name.
 */
function toFriendlyError(error) {
  if (error?.message !== 'project_limit_reached') return error

  let limit = null
  let current = null
  try {
    const detail = JSON.parse(error.details || '{}')
    limit = typeof detail.limit === 'number' ? detail.limit : null
    current = typeof detail.current === 'number' ? detail.current : null
  } catch {
    // Detail failed to parse — the banner still renders with limit/current
    // as null, which just omits the specific numbers rather than crashing.
  }

  const friendly = new Error('وصلت للحد الأقصى من المشاريع المسموح بإنشائها.')
  friendly.code = 'project_limit_reached'
  friendly.limit = limit
  friendly.current = current
  return friendly
}
