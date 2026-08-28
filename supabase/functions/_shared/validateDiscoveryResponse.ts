/* Ported verbatim from server/lib/validateDiscoveryResponse.js. The body is unchanged on purpose:
   these validators are already debugged against real model output, and
   the whole point of the shape check is that it fails closed. Only the
   signature is typed for Deno. */
// Shape-checks a parsed discovery JSON response before it's allowed to
// reach the frontend (product spec section 47) — a malformed or
// partially-wrong AI response must never crash the app or get passed
// through as-is. Deliberately strict: any field missing/mistyped fails
// the whole response so the caller retries instead of shipping a
// half-broken structure to the UI.

const INTENTS = new Set(['follow_up_question', 'acknowledgment', 'clarification'])
const STATUSES = new Set(['in_progress', 'ready'])
const PRIORITIES = new Set(['Must Have', 'Should Have', 'Could Have', "Won't Have", 'Unspecified'])
const REQUIREMENT_TYPES = new Set(['goal', 'target_user', 'feature', 'functional', 'non_functional', 'risk', 'assumption'])

export function validateDiscoveryResponse(value: any): boolean {
  if (!value || typeof value !== 'object') return false
  if (typeof value.response !== 'string' || !value.response.trim()) return false
  if (!INTENTS.has(value.intent)) return false
  if (!Array.isArray(value.requirements_extracted)) return false
  if (!Array.isArray(value.missing_information)) return false
  if (!Array.isArray(value.contradictions)) return false
  if (typeof value.confidence !== 'number' || Number.isNaN(value.confidence) || value.confidence < 0 || value.confidence > 100) return false
  if (!STATUSES.has(value.discovery_status)) return false

  for (const requirement of value.requirements_extracted) {
    if (!requirement || typeof requirement !== 'object') return false
    if (typeof requirement.id !== 'string' || typeof requirement.title !== 'string' || typeof requirement.description !== 'string') return false
    if (!PRIORITIES.has(requirement.priority)) return false
    if (!REQUIREMENT_TYPES.has(requirement.type)) return false
  }
  for (const item of value.missing_information) {
    if (typeof item !== 'string') return false
  }
  for (const contradiction of value.contradictions) {
    if (!contradiction || typeof contradiction !== 'object' || typeof contradiction.description !== 'string') return false
  }

  return true
}
