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
  if (insertError) throw insertError

  return project
}
