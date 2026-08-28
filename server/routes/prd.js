import { Router } from 'express'
import { stripJsonFences, withRetries } from '../lib/jsonUtils.js'
import { sanitizeProjectSlug } from '../lib/prdUtils.js'
import { validatePrdResponse } from '../lib/validatePrdResponse.js'
import { PRD_SYSTEM_PROMPT } from '../prompts/groq/prd.system.js'
import { generateJSON as generateGeminiJSON } from '../providers/GeminiProvider.js'
import { generateJSON as generateGroqJSON } from '../providers/GroqProvider.js'

// Spec section 48's exact copy for "we couldn't make sense of the AI's
// reply" — never leak a raw stack trace or parse error to the client.
const GENERIC_ERROR_MESSAGE = 'واجهنا مشكلة أثناء بناء الوثيقة. حاول مرة ثانية.'

const REQUIREMENT_TYPES = ['goal', 'target_user', 'feature', 'functional', 'non_functional', 'risk', 'assumption']

export const prdRouter = Router()

/**
 * Trims the frontend's requirementsByType payload down to just the fields
 * the model needs (req_key/title/description/priority), dropping id/
 * status/source/timestamps — same "send only what the prompt actually
 * asks for" discipline as discovery.js's history filter.
 */
function buildRequirementsPayload(requirements) {
  const grouped = {}
  let total = 0
  for (const type of REQUIREMENT_TYPES) {
    const list = Array.isArray(requirements?.[type]) ? requirements[type] : []
    grouped[type] = list
      .filter((item) => item && typeof item.title === 'string' && item.title.trim())
      .map((item) => ({
        req_key: typeof item.req_key === 'string' ? item.req_key : null,
        title: item.title,
        description: typeof item.description === 'string' ? item.description : '',
        priority: item.priority || 'Unspecified',
      }))
    total += grouped[type].length
  }
  return { grouped, total }
}

/**
 * Runs `generateFn` (a provider's generateJSON) through the parse +
 * shape-validate + retry pipeline — same pattern as discovery.js's
 * runProvider, reused here for the PRD-generation provider chain.
 */
async function runProvider(generateFn, userMessage, attempts) {
  return withRetries(
    async () => {
      const raw = await generateFn(PRD_SYSTEM_PROMPT, [{ role: 'user', content: userMessage }])
      const candidate = JSON.parse(stripJsonFences(raw))
      if (!validatePrdResponse(candidate)) {
        throw new Error('PRD response failed shape validation')
      }
      return candidate
    },
    attempts,
    2000,
  )
}

/**
 * POST /api/prd
 * Body: { projectId, projectName, requirements: { goal: [...], target_user: [...], ... } }
 * (see src/services/requirementsService.js's listRequirements + the
 * frontend's grouping in RequirementsReview.jsx for how `requirements`
 * is built — the backend stays stateless and never touches Supabase
 * directly, same pattern as /api/discovery).
 *
 * Groq is primary here, not Gemini (spec sections 27-29: "Groq لا يحلل
 * العميل. Groq يستقبل Requirements JSON فقط... Senior Product Manager +
 * Technical Writer"). Gemini is used only as a resilience fallback if
 * Groq is fully exhausted (both retries) — mirroring discovery.js's
 * Gemini-primary/Groq-fallback pattern in reverse. This is a deliberate
 * choice, not a default: PRD generation has no persona/dialect
 * requirement the way discovery does, so either provider can honor the
 * same JSON contract, and adding the fallback costs nothing but a few
 * extra lines given generateJSON's shared interface.
 */
prdRouter.post('/prd', async (req, res) => {
  const { projectId, projectName, requirements } = req.body || {}
  const { grouped, total } = buildRequirementsPayload(requirements)

  if (total === 0) {
    res.status(400).json({ error: 'invalid_request', message: 'لا توجد متطلبات كافية لتوليد وثيقة PRD بعد.' })
    return
  }

  const userMessage = JSON.stringify({
    project_name: typeof projectName === 'string' && projectName.trim() ? projectName.trim() : 'مشروع بدون اسم',
    requirements: grouped,
  })

  let result = null

  try {
    result = await runProvider(generateGroqJSON, userMessage, 2)
  } catch (groqErr) {
    console.warn(`[areep-prd] Groq failed for project ${projectId ?? '(unknown)'}, falling back to Gemini:`, groqErr.message)

    try {
      result = await runProvider(generateGeminiJSON, userMessage, 2)
    } catch (geminiErr) {
      console.warn(`[areep-prd] Gemini fallback also failed for project ${projectId ?? '(unknown)'}:`, geminiErr.message)
      res.status(502).json({ error: 'prd_failed', message: GENERIC_ERROR_MESSAGE })
      return
    }
  }

  // version/generated_at/project_slug are never trusted verbatim from the
  // model — same defensive spirit as the sibling portfolio's
  // normalizePRDData (prdId/version/date computed server-side, project_slug
  // sanitized) even though the fuller normalization now happens client-side
  // in src/lib/prdMapper.js (this route's output shape is spec section 29's
  // structured JSON, not the PDF renderer's own shape).
  result.metadata = {
    project_name: (result.metadata?.project_name || projectName || 'مشروع بدون اسم').toString(),
    project_slug: sanitizeProjectSlug(result.metadata?.project_slug),
    version: 'v1.0',
    generated_at: new Date().toISOString(),
  }

  res.status(200).json(result)
})
