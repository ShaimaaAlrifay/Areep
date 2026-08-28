/* Ported verbatim from server/lib/validatePrdResponse.js. The body is unchanged on purpose:
   these validators are already debugged against real model output, and
   the whole point of the shape check is that it fails closed. Only the
   signature is typed for Deno. */
// Shape-checks a parsed PRD JSON response before it's allowed to reach the
// frontend (spec section 29/48, same discipline as validateDiscoveryResponse.js)
// — a malformed or partially-wrong AI response must never crash the PDF
// renderer or get passed through as-is. Only the fields the spec's
// contract actually mandates are required here; the richer "extended"
// fields the prompt also asks for (sections.opportunity, sections.key_insights,
// user_stories[].requirement_ref, ...) are opportunistic — src/lib/prdMapper.js
// defaults them defensively when absent, same spirit as normalizePRDData in
// the sibling portfolio's server.js. Deliberately strict on the mandated
// core so a bad response fails validation and gets retried instead of
// shipping a half-broken document.

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function validatePrdResponse(value: any): boolean {
  if (!value || typeof value !== 'object') return false

  if (!value.metadata || typeof value.metadata !== 'object') return false
  if (!isNonEmptyString(value.metadata.project_name)) return false

  const sections = value.sections
  if (!sections || typeof sections !== 'object') return false
  for (const key of ['executive_summary', 'problem', 'vision', 'goals']) {
    if (!isNonEmptyString(sections[key])) return false
  }

  if (!Array.isArray(value.requirements)) return false
  for (const requirement of value.requirements) {
    if (!requirement || typeof requirement !== 'object') return false
    if (!isNonEmptyString(requirement.title)) return false
  }

  if (!Array.isArray(value.user_stories)) return false
  for (const story of value.user_stories) {
    if (!story || typeof story !== 'object') return false
    if (typeof story.as_a !== 'string' || typeof story.i_want !== 'string' || typeof story.so_that !== 'string') return false
  }

  if (!Array.isArray(value.acceptance_criteria)) return false
  for (const criterion of value.acceptance_criteria) {
    if (!criterion || typeof criterion !== 'object') return false
  }

  if (!Array.isArray(value.risks)) return false
  if (!Array.isArray(value.assumptions)) return false

  return true
}
