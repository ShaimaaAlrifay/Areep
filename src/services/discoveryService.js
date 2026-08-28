// Thin client for the discovery endpoint. The transport (Edge Function vs.
// the legacy Express backend) and all error normalisation live in
// aiBackend.js, shared with prdService.js.
import { callAiBackend } from './aiBackend'

const MESSAGES = {
  network: 'تعذّر الاتصال بخادم أريب. تحقّق من اتصالك بالإنترنت وحاول مرة ثانية.',
  generic: 'ما قدرت أحلل الإجابة حالياً. حاول مرة ثانية.',
}

/**
 * Sends the full discovery conversation so far (including the just-sent
 * user message as the last entry) to the discovery function.
 *
 * @param {string} projectId
 * @param {{role: 'user'|'assistant', content: string}[]} history
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function sendDiscoveryMessage(projectId, history) {
  return callAiBackend('discovery', { projectId, history }, MESSAGES)
}
