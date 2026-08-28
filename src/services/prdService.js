// Thin client for the areep/server Express backend's PRD-generation
// endpoint — same shape as discoveryService.js's sendDiscoveryMessage.
// The base URL (and the check that it is deployable) lives in apiBase.js,
// which both of these clients share.
import { API_BASE } from './apiBase'

const NETWORK_ERROR_MESSAGE = 'تعذّر الاتصال بخادم أريب. تأكد إنه شغّال (npm run server) وحاول مرة ثانية.'
const GENERIC_ERROR_MESSAGE = 'واجهنا مشكلة أثناء بناء الوثيقة. حاول مرة ثانية.'

/**
 * Sends a project's normalized requirements (grouped by type — see
 * requirementsService.js's listRequirements + RequirementsReview.jsx's
 * `bySection` grouping) to POST /api/prd.
 *
 * @param {string} projectId
 * @param {string} projectName
 * @param {Record<string, Array<{req_key: string, title: string, description: string, priority: string}>>} requirementsByType
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function generatePRD(projectId, projectName, requirementsByType) {
  let response
  try {
    response = await fetch(`${API_BASE}/api/prd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, projectName, requirements: requirementsByType }),
    })
  } catch {
    // Backend not running / unreachable — never let a network failure
    // surface as a raw exception in the UI.
    return { data: null, error: NETWORK_ERROR_MESSAGE }
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    return { data: null, error: body?.message || GENERIC_ERROR_MESSAGE }
  }
  if (!body) {
    return { data: null, error: GENERIC_ERROR_MESSAGE }
  }

  return { data: body, error: null }
}
