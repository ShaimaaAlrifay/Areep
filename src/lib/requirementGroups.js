// Shared "requirements → grouped by type" helpers.
//
// Three different screens now need the exact same grouping (the shape
// POST /api/prd's body and src/lib/prdMapper.js's goals table both expect):
// the Requirements Review page, the chat's "discovery finished" PRD action
// (src/features/projects/usePrdGeneration.js), and the PRD preview page
// when it's opened directly instead of navigated to. Keeping the grouping
// and the discovery_state fallback in one place is what stops those three
// from silently drifting apart — an earlier version of PrdPreview.jsx
// passed `{}` for this and lost the whole "الأهداف" page of the generated
// document as a result.

import { REQUIREMENT_TYPE_ORDER } from './constants'

/** Buckets `requirements` rows by `type`, always returning every known type as a key (empty array when unused). */
export function groupRequirementsByType(items) {
  const grouped = {}
  for (const type of REQUIREMENT_TYPE_ORDER) grouped[type] = []
  for (const item of Array.isArray(items) ? items : []) {
    if (item && grouped[item.type]) grouped[item.type].push(item)
  }
  return grouped
}

/** Total item count across every bucket — "do we have enough to build a document at all?" */
export function countGrouped(grouped) {
  return REQUIREMENT_TYPE_ORDER.reduce((total, type) => total + (grouped?.[type]?.length || 0), 0)
}

/**
 * Read-only fallback view of a project's requirements, reconstructed from
 * the raw `projects.discovery_state.requirements_extracted` snapshot the
 * discovery agent writes every turn. Used when the normalized
 * `requirements` table hasn't been migrated yet or hasn't been populated
 * for this project — same rows the Requirements Review page falls back to,
 * so a PRD generated on that path carries the same content the user was
 * just looking at rather than coming back empty.
 */
export function requirementsFromDiscoveryState(project) {
  const extracted = project?.discovery_state?.requirements_extracted
  if (!Array.isArray(extracted)) return []
  return extracted
    .filter((item) => item && typeof item.id === 'string' && typeof item.type === 'string')
    .map((item) => ({
      id: null,
      req_key: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      priority: item.priority || 'Unspecified',
      source: 'ai',
    }))
}
