// Thin client for the PRD-generation endpoint. The transport (Edge Function
// vs. the legacy Express backend) and all error normalisation live in
// aiBackend.js, shared with discoveryService.js.
import { callAiBackend } from './aiBackend'

const MESSAGES = {
  network: 'تعذّر الاتصال بخادم أريب. تحقّق من اتصالك بالإنترنت وحاول مرة ثانية.',
  generic: 'واجهنا مشكلة أثناء بناء الوثيقة. حاول مرة ثانية.',
}

/**
 * Sends a project's normalized requirements (grouped by type — see
 * requirementsService.js's listRequirements + RequirementsReview.jsx's
 * `bySection` grouping) to the PRD-generation function.
 *
 * @param {string} projectId
 * @param {string} projectName
 * @param {Record<string, Array<{req_key: string, title: string, description: string, priority: string}>>} requirementsByType
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function generatePRD(projectId, projectName, requirementsByType) {
  return callAiBackend('prd', { projectId, projectName, requirements: requirementsByType }, MESSAGES)
}
