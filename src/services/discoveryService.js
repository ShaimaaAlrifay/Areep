// Thin client for the areep/server Express backend's discovery endpoint.
// The base URL (and the check that it is deployable) lives in apiBase.js,
// which both of these clients share.
import { API_BASE } from './apiBase'

const NETWORK_ERROR_MESSAGE = 'تعذّر الاتصال بخادم أريب. تأكد إنه شغّال (npm run server) وحاول مرة ثانية.'
const GENERIC_ERROR_MESSAGE = 'ما قدرت أحلل الإجابة حالياً. حاول مرة ثانية.'

/**
 * Sends the full discovery conversation so far (including the just-sent
 * user message as the last entry) to POST /api/discovery.
 *
 * @param {string} projectId
 * @param {{role: 'user'|'assistant', content: string}[]} history
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function sendDiscoveryMessage(projectId, history) {
  let response
  try {
    response = await fetch(`${API_BASE}/api/discovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, history }),
    })
  } catch {
    // Backend not running / unreachable — never let a network failure
    // surface as a raw exception in the chat UI.
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
