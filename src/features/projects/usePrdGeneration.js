import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { countGrouped, groupRequirementsByType, requirementsFromDiscoveryState } from '../../lib/requirementGroups'
import { mapPrdToDocumentData } from '../../lib/prdMapper'
import { generatePRD } from '../../services/prdService'
import { updateProjectPrd } from '../../services/projectsService'
import { listRequirements } from '../../services/requirementsService'
import { EVENTS, track } from '../../lib/analytics'

const GENERIC_ERROR = 'واجهنا مشكلة أثناء بناء الوثيقة. حاول مرة ثانية.'
const NO_REQUIREMENTS_ERROR = 'ما فيه متطلبات كافية لبناء الوثيقة بعد. أكمل المحادثة مع أريب شوي.'
const RENDER_ERROR = 'الوثيقة اتولّدت بس ما قدرنا نجهّز ملف PDF. افتح صفحة الوثيقة وجرّب التصدير من هناك.'

/**
 * The one shared "build this project's PRD" flow, used by both entry
 * points so they can never drift: the chat's own action once discovery
 * reports `ready` (Sections 24, 27) and the Requirements Review page's
 * "توليد PRD" button (Section 31).
 *
 * The whole sequence, in order:
 *  1. resolve the project's requirements grouped by type — the caller's
 *     already-loaded copy when it has one, otherwise a fresh read of the
 *     `requirements` table, otherwise the `discovery_state` snapshot
 *     (see requirementGroups.js for why all three paths exist);
 *  2. POST /api/prd (Groq primary, Gemini fallback — server/routes/prd.js);
 *  3. best-effort persist onto the project row + flip status to
 *     'prd_generated' so the PRD tab appears and survives a reload;
 *  4. render the document through Areeb's own PDF template
 *     (src/templates/areep/) and hand the file to the user right away —
 *     this is the actual deliverable, so it downloads on this click
 *     rather than making them find a second button;
 *  5. navigate to the preview, carrying both the PRD and the grouped
 *     requirements in router state so the preview renders instantly and
 *     with the goals page intact.
 *
 * The PDF template is imported dynamically at step 4 rather than at the
 * top of this file. It pulls in @react-pdf/renderer, which is larger than
 * the rest of the application put together; a static import meant every
 * user who merely opened a chat downloaded a whole PDF engine on the
 * chance they might later press "generate". The import sits inside the
 * existing try, so a failed chunk fetch degrades exactly like a failed
 * render already did.
 *
 * Step 4 failing does not fail the whole flow: the document itself exists
 * and is persisted at that point, so the user is still taken to the
 * preview (which builds the PDF again on its own) with an explanatory
 * message instead of losing a real generation to a render error.
 */
export function usePrdGeneration(projectId, project, providedRequirementsByType = null) {
  const navigate = useNavigate()
  const [state, setState] = useState({ generating: false, error: null })

  const generate = useCallback(async () => {
    if (state.generating || !project) return

    setState({ generating: true, error: null })

    let grouped = providedRequirementsByType
    if (!grouped || countGrouped(grouped) === 0) {
      const { data, error } = await listRequirements(projectId)
      // A missing/unmigrated table is not an error here — it just means the
      // discovery_state snapshot below is the only source available.
      if (error) console.warn('[areep] could not load requirements for PRD generation:', error.message)
      grouped = groupRequirementsByType(data && data.length ? data : requirementsFromDiscoveryState(project))
    }

    if (countGrouped(grouped) === 0) {
      setState({ generating: false, error: NO_REQUIREMENTS_ERROR })
      return
    }

    const { data: prd, error } = await generatePRD(projectId, project.name, grouped)
    if (error || !prd) {
      setState({ generating: false, error: error || GENERIC_ERROR })
      return
    }

    const { error: persistError } = await updateProjectPrd(projectId, prd)
    if (persistError) {
      console.warn('[areep] could not persist PRD (likely unmigrated prd_data column):', persistError.message)
    }

    track(EVENTS.PRD_GENERATED, { requirements: countGrouped(grouped) })

    let renderError = null
    try {
      const { buildPRDBlob, triggerPRDDownload } = await import('../../templates/areep/prdPdf')
      const { blob, filename } = await buildPRDBlob(mapPrdToDocumentData(prd, grouped, project))
      triggerPRDDownload(blob, filename)
      track(EVENTS.PRD_EXPORTED, { format: 'pdf', source: 'generation' })
    } catch (err) {
      console.warn('[areep] PRD PDF render failed, continuing to preview:', err?.message || err)
      renderError = RENDER_ERROR
    }

    setState({ generating: false, error: renderError })
    navigate(`/chat/${projectId}/prd`, { state: { prd, requirementsByType: grouped } })
  }, [projectId, project, providedRequirementsByType, state.generating, navigate])

  return { ...state, generate }
}
