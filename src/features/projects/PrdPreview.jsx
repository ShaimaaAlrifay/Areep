import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useProject } from '../../hooks/useProject'
import { STATUS_LABELS } from '../../lib/constants'
import { buildPrdMarkdown, triggerTextDownload } from '../../lib/prdMarkdown'
import { mapPrdToDocumentData } from '../../lib/prdMapper'
import { groupRequirementsByType, requirementsFromDiscoveryState } from '../../lib/requirementGroups'
import { EVENTS, track } from '../../lib/analytics'
import { PrdFeedback } from './PrdFeedback'
import { getProjectPrd } from '../../services/projectsService'
import { listRequirements } from '../../services/requirementsService'
import { buildPRDBlob, countPdfPages, measureSectionPages, triggerPRDDownload } from '../../templates/areep/prdPdf'
import { ProjectTabs } from './ChatPage'


/**
 * PRD Preview (spec section 31) — a simplified 3-pane document-editor
 * layout: left = table of contents (jumps the embedded PDF to that
 * page via the `#page=N` blob-URL fragment Chromium's built-in PDF
 * viewer honors), center = the actual generated PDF embedded live (not
 * a mockup — the same buildPRDBlob() the "تصدير PDF" button downloads),
 * right = actions + metadata. "Edit" / "Regenerate Section" (also
 * spec section 31) are deliberately deferred — shown, disabled, and
 * labeled "قريبًا" rather than faked as working.
 */
export function PrdPreview() {
  const { projectId } = useParams()
  const { organizationId } = useOutletContext()
  const location = useLocation()
  const { project, loading: projectLoading, notFound } = useProject(projectId, organizationId)

  // The just-generated PRD arrives via router state (RequirementsReview.jsx
  // navigates here right after a successful POST /api/prd) — that's the
  // common path and needs no extra round-trip. A direct visit/reload falls
  // back to the best-effort persisted copy (see getProjectPrd's own
  // comment for why this is a separate call from useProject's).
  const [persisted, setPersisted] = useState({ loading: !location.state?.prd, prd: null })

  useEffect(() => {
    if (location.state?.prd || !projectId) {
      setPersisted({ loading: false, prd: null })
      return undefined
    }
    let mounted = true
    getProjectPrd(projectId).then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        console.warn('[areep] could not load persisted PRD (likely unmigrated prd_data column):', error.message)
      }
      setPersisted({ loading: false, prd: data?.prd_data || null })
    })
    return () => {
      mounted = false
    }
  }, [projectId, location.state])

  const prd = location.state?.prd || persisted.prd

  /**
   * The grouped requirements are needed for the document's "الأهداف
   * ومؤشرات النجاح" page — the API's PRD contract has no metrics shape, so
   * prdMapper builds that table from the project's own `goal` rows. This
   * page used to pass `{}` here, which silently emptied that entire page of
   * every generated PDF. The generation flow hands the grouping over in
   * router state (no extra round-trip on the common path); a direct visit
   * or reload reads it back the same way the Requirements page does.
   */
  const [requirementsByType, setRequirementsByType] = useState(() => location.state?.requirementsByType || null)

  useEffect(() => {
    if (requirementsByType || !projectId) return undefined
    let mounted = true
    listRequirements(projectId).then(({ data, error }) => {
      if (!mounted) return
      if (error) console.warn('[areep] could not load requirements for the PRD preview:', error.message)
      setRequirementsByType(groupRequirementsByType(data && data.length ? data : requirementsFromDiscoveryState(project)))
    })
    return () => {
      mounted = false
    }
  }, [projectId, project, requirementsByType])

  const [activePage, setActivePage] = useState(1)
  const [toc, setToc] = useState([])
  const [pdf, setPdf] = useState({ status: 'idle', blob: null, url: null, filename: null, pageCount: null, error: null })

  const mapped = useMemo(
    () => (prd ? mapPrdToDocumentData(prd, requirementsByType || {}, project || {}) : null),
    [prd, requirementsByType, project],
  )

  /*
   * The table of contents is measured from the same data the document is
   * built from, rather than declared — see measureSectionPages(). It runs
   * alongside the main build instead of after it so the TOC and the
   * document appear together; a failure here only costs the TOC, so it
   * degrades to an empty list rather than blocking the preview.
   */
  useEffect(() => {
    if (!mapped) return undefined
    let cancelled = false
    measureSectionPages(mapped)
      .then((sections) => {
        if (!cancelled) setToc(sections)
      })
      .catch((err) => {
        console.warn('[areep] could not measure PRD section pages:', err.message)
        if (!cancelled) setToc([])
      })
    return () => {
      cancelled = true
    }
  }, [mapped])

  useEffect(() => {
    if (!mapped) return undefined
    let cancelled = false
    let objectUrl = null
    setPdf({ status: 'building', blob: null, url: null, filename: null, pageCount: null, error: null })

    buildPRDBlob(mapped)
      .then(async ({ blob, filename }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        const pageCount = await countPdfPages(blob).catch(() => null)
        if (cancelled) return
        setPdf({ status: 'ready', blob, url: objectUrl, filename, pageCount, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[areep] PRD PDF build failed:', err.message)
        setPdf({ status: 'error', blob: null, url: null, filename: null, pageCount: null, error: 'ما قدرنا نجهّز ملف PDF. حاول تحديث الصفحة.' })
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mapped])

  if (projectLoading || persisted.loading) {
    return <div className="page-loading">جارٍ تحميل المشروع…</div>
  }

  if (notFound) {
    return (
      <div className="chat-empty">
        <h1 className="chat-empty-title">المشروع غير موجود</h1>
        <p className="text-secondary">إما أن هذا المشروع غير موجود، أو أنه لا يتبع مساحة العمل الخاصة بك.</p>
        <Link to="/chat" className="btn btn-secondary">
          العودة
        </Link>
      </div>
    )
  }

  return (
    <div className="chat-with-header">
      <header className="chat-header">
        <div className="chat-header-title-row">
          <h1>{project.name}</h1>
          <span className="chat-header-status">{STATUS_LABELS[project.status] || project.status}</span>
        </div>
        <ProjectTabs projectId={projectId} showPrd={Boolean(prd) || project.status === 'prd_generated'} />
      </header>

      {!prd ? (
        <div className="chat-empty">
          <h1 className="chat-empty-title">لا توجد وثيقة PRD بعد</h1>
          <p className="text-secondary">ولّد وثيقة PRD أولًا من صفحة المتطلبات.</p>
          <Link to={`/chat/${projectId}/requirements`} className="btn btn-primary">
            الذهاب إلى المتطلبات
          </Link>
        </div>
      ) : (
        <div className="prd-preview">
          <aside className="prd-pane prd-toc">
            <h2 className="prd-pane-title">محتويات الوثيقة</h2>
            <ul className="prd-toc-list">
              {toc.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`prd-toc-item${activePage === item.page ? ' active' : ''}`}
                    onClick={() => setActivePage(item.page)}
                    disabled={pdf.status !== 'ready'}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="prd-document">
            {pdf.status === 'building' && <div className="page-loading">أريب يجهّز الملف…</div>}
            {pdf.status === 'error' && <p className="form-error">{pdf.error}</p>}
            {/*
              `key` is load-bearing, not cosmetic: the only thing that changes
              between pages is the URL fragment, and a browser will not
              re-navigate an iframe whose src differs only after the `#`. React
              would happily patch the attribute and Chrome's PDF viewer would
              ignore it. Keying on activePage tears the element down and mounts
              a fresh one, so the viewer reads `#page=N` on its initial load —
              the only point at which it honours the fragment.
            */}
            {pdf.status === 'ready' && (
              <iframe key={activePage} title="معاينة وثيقة PRD" src={`${pdf.url}#page=${activePage}`} className="prd-frame" />
            )}
          </div>

          <aside className="prd-pane prd-actions">
            <h2 className="prd-pane-title">إجراءات</h2>
            <button type="button" className="btn btn-primary btn-block" disabled={pdf.status !== 'ready'} onClick={() => {
                if (!pdf.blob) return
                triggerPRDDownload(pdf.blob, pdf.filename)
                track(EVENTS.PRD_EXPORTED, { format: 'pdf', source: 'preview' })
              }}>
              تصدير PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                triggerTextDownload(buildPrdMarkdown(prd), `${pdf.filename ? pdf.filename.replace(/\.pdf$/i, '') : 'PRD'}.md`)
                track(EVENTS.PRD_EXPORTED, { format: 'markdown', source: 'preview' })
              }}
            >
              تصدير Markdown
            </button>
            <button type="button" className="btn btn-ghost btn-block" disabled>
              تعديل قسم <span className="badge-soon">قريبًا</span>
            </button>
            <button type="button" className="btn btn-ghost btn-block" disabled>
              إعادة توليد قسم <span className="badge-soon">قريبًا</span>
            </button>

            <div className="prd-meta-block">
              <p className="prd-meta-row">
                <span>الإصدار</span>
                <span className="ltr-nums">{mapped?.meta?.version}</span>
              </p>
              <p className="prd-meta-row">
                <span>عدد الصفحات</span>
                <span className="ltr-nums">{pdf.pageCount ?? '—'}</span>
              </p>
              <p className="prd-meta-row">
                <span>تاريخ الإنشاء</span>
                <span>{mapped?.meta?.date}</span>
              </p>
            </div>

            <PrdFeedback projectId={projectId} />
          </aside>
        </div>
      )}
    </div>
  )
}
