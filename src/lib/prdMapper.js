// Maps a validated POST /api/prd response (spec section 29's structured
// JSON: metadata/sections/requirements/user_stories/acceptance_criteria/
// risks/assumptions — see server/lib/validatePrdResponse.js) onto the
// shape src/templates/areep/prdPdf.jsx's <PRDDocument> actually reads
// (confirmed by reading prdPdf.jsx + prdComponents.jsx directly, not
// guessed — see prdSampleData.js for a full worked example of that
// shape). The two shapes are NOT the same: the API contract is flatter
// (a handful of prose sections, a flat requirements list) while the PDF
// template wants richer per-page sub-objects (problemAnalysis's five
// fields, a metrics-style goals table, per-story acceptance criteria,
// in/out-of-scope lists, governance log). This file is that mapping —
// deliberately defensive throughout (same "never let a partially-formed
// AI response crash the renderer" spirit as the sibling portfolio's
// normalizePRDData in server.js): every field has a sane Arabic fallback,
// nothing here ever throws on a missing/malformed key.
//
// Two documented simplifications, both because the PDF template
// (8 fixed pages) has no dedicated slot for either concept:
//  - `risks` (from the API response) are folded into the `assumptions`
//    list with a "خطر — " prefix, rather than silently dropped, since
//    prdPdf.jsx's page 07 only renders one array under "الافتراضات".
//  - `openQuestions` (page 07's "الأسئلة المفتوحة" table) is NOT derived
//    from the PRD response at all (the API contract has no open-questions
//    field) — it's carried through from the project's own
//    `discovery_state.missing_information` (the same list already shown
//    on the Requirements Review page's "أسئلة مفتوحة" section), which is
//    real discovered-but-unresolved data rather than something the mapper
//    would otherwise have to invent.

const FALLBACK = 'لم تتم مناقشة هذا الجانب بعد بالتفصيل.'

function s(value, fallback = FALLBACK) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function arr(value) {
  return Array.isArray(value) ? value : []
}

function nonEmptyStrings(value) {
  return arr(value).filter((item) => typeof item === 'string' && item.trim())
}

/**
 * MoSCoW priority as stored in `requirements` rows ("Must Have", ...) → the
 * shorter enum prdPdf.jsx's translatePriority expects. All five schema
 * values map faithfully: an earlier version folded "Won't Have" and
 * "Unspecified" into "Could", which printed a deferred or unprioritized
 * requirement as "اختياري" in the exported document. `translatePriority`
 * now carries Arabic labels for those two as well (see prdComponents.jsx).
 */
const MOSCOW = {
  'Must Have': 'Must',
  'Should Have': 'Should',
  'Could Have': 'Could',
  "Won't Have": "Won't",
  Unspecified: 'Unspecified',
}

function toMoscow(priority) {
  return MOSCOW[priority] || 'Unspecified'
}

function buildStoryQuote(story) {
  const asA = s(story?.as_a, 'مستخدم')
  const iWant = typeof story?.i_want === 'string' && story.i_want.trim() ? story.i_want.trim() : ''
  const soThat = typeof story?.so_that === 'string' && story.so_that.trim() ? story.so_that.trim() : ''
  if (!iWant) return FALLBACK
  return `بصفتي ${asA}، أبي ${iWant}${soThat ? ` عشان ${soThat}` : ''}.`
}

/**
 * @param {object} prd - validated POST /api/prd response
 * @param {Record<string, Array<{req_key?: string, title?: string, description?: string, priority?: string}>>} requirementsByType - the same grouping sent to the API (used here for the goals table, which the API contract doesn't carry a metrics shape for)
 * @param {object} project - the loaded project row (used for discovery_state.missing_information → openQuestions, and as a name fallback)
 */
export function mapPrdToDocumentData(prd, requirementsByType = {}, project = {}) {
  const metadata = prd?.metadata || {}
  const sections = prd?.sections || {}

  // Both of these are derived from the document itself, never from "now":
  // this mapper runs again on every preview render and on every re-export,
  // and a Math.random()-based id (what an earlier version used) meant the
  // same stored PRD printed a different "PRD-2026-xxx" on its cover each
  // time, while a `new Date()` date meant reopening last week's document
  // stamped it with today's. The id's numeric suffix is a small stable
  // hash of the project name + generation timestamp, so the same document
  // always renders the same cover.
  const generatedAt = typeof metadata.generated_at === 'string' ? new Date(metadata.generated_at) : null
  const now = generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt : new Date()
  const seed = `${metadata.project_name || project?.name || ''}|${metadata.generated_at || ''}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 900
  const prdId = `PRD-${now.getFullYear()}-${String(hash + 100)}`
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const requirementsSource = arr(prd?.requirements)
  const functionalRequirements = requirementsSource.length
    ? requirementsSource.map((requirement, index) => ({
        id: s(requirement?.req_key, `FR-${String(index + 1).padStart(2, '0')}`),
        title: s(requirement?.title, 'متطلب بدون عنوان'),
        description: s(requirement?.description),
        priority: toMoscow(requirement?.priority),
      }))
    : [{ id: 'FR-01', title: 'لم تُحدد متطلبات بعد', description: FALLBACK, priority: 'Should' }]

  const goalItems = arr(requirementsByType?.goal)
  const goals = goalItems.length
    ? goalItems.map((goal) => ({
        value: goal?.req_key || '—',
        name: s(goal?.title, 'هدف بدون عنوان'),
        description: s(goal?.description),
        measurement: 'يُحدد لاحقًا مع تقدّم المشروع',
      }))
    : [{ value: '—', name: 'لم تُحدد أهداف قابلة للقياس بعد', description: FALLBACK, measurement: '—' }]

  const acceptanceByRef = {}
  for (const criterion of arr(prd?.acceptance_criteria)) {
    const ref = criterion?.requirement_ref
    if (!ref || typeof criterion?.criteria !== 'string' || !criterion.criteria.trim()) continue
    if (!acceptanceByRef[ref]) acceptanceByRef[ref] = []
    acceptanceByRef[ref].push(criterion.criteria.trim())
  }

  const storiesSource = arr(prd?.user_stories)
  const userStories = storiesSource.length
    ? storiesSource.map((story, index) => ({
        number: String(index + 1).padStart(2, '0'),
        quote: buildStoryQuote(story),
        gloss: '',
        acceptance: acceptanceByRef[story?.requirement_ref]?.length ? acceptanceByRef[story.requirement_ref] : ['لم تُحدد معايير قبول بعد.'],
      }))
    : [{ number: '01', quote: FALLBACK, gloss: '', acceptance: ['لم تُحدد معايير قبول بعد.'] }]

  const scopeIn = nonEmptyStrings(sections.scope_in)
  const scopeOut = nonEmptyStrings(sections.scope_out)

  const missingInfo = nonEmptyStrings(project?.discovery_state?.missing_information)
  const openQuestions = missingInfo.length
    ? missingInfo.map((question) => ({ question, owner: 'المنتج' }))
    : [{ question: 'ما الخطوة التالية بعد هذا الملخص؟', owner: 'المنتج' }]

  const assumptions = []
  for (const assumption of arr(prd?.assumptions)) {
    const text = s(assumption?.description || assumption?.title, '')
    if (text) assumptions.push(text)
  }
  for (const risk of arr(prd?.risks)) {
    const text = s(risk?.description || risk?.title, '')
    if (text) assumptions.push(`خطر — ${text}`)
  }
  if (assumptions.length === 0) assumptions.push('لم تُطرح افتراضات صريحة أثناء المحادثة بعد.')

  const keyInsights = nonEmptyStrings(sections.key_insights)

  return {
    meta: {
      projectName: s(metadata.project_name || project?.name, 'مشروع بدون اسم'),
      shortDescription: s(sections.executive_summary),
      projectSlug: /^[A-Za-z0-9_]+$/.test(metadata.project_slug || '') ? metadata.project_slug : 'Areeb_PRD',
      prdId,
      version: typeof metadata.version === 'string' && metadata.version ? metadata.version : 'v1.0',
      status: 'Draft',
      date,
    },
    executiveSummary: {
      description: 'لماذا نبني هذا المشروع، في صفحة واحدة.',
      problem: s(sections.problem),
      opportunity: s(sections.opportunity),
      solution: s(sections.solution || sections.vision),
      outcome: s(sections.outcome),
      keyInsights: keyInsights.length ? keyInsights : [s(sections.goals)],
    },
    problemAnalysis: {
      currentState: s(sections.current_state),
      friction: s(sections.friction),
      rootCause: s(sections.root_cause),
      opportunity: s(sections.opportunity),
      desiredState: s(sections.desired_state || sections.vision),
    },
    goals,
    functionalRequirements,
    userStories,
    scope: {
      inScope: scopeIn.length ? scopeIn : ['لم يُحدد نطاق العمل بعد بالتفصيل.'],
      outOfScope: scopeOut.length ? scopeOut : ['لم يُحدد ما هو خارج النطاق بعد.'],
    },
    assumptions,
    openQuestions,
    governance: [
      {
        version: 'v1.0',
        date,
        change: 'تم توليد هذا المستند تلقائيًا من متطلبات المشروع المنظّمة عبر أريب.',
        owner: 'Areeb',
        status: 'Draft',
      },
    ],
  }
}
