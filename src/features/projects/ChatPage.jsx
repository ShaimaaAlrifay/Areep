import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Chat } from '../../components/Chat'
import { useMessages } from '../../hooks/useMessages'
import { insertMessage } from '../../services/messagesService'
import { sendDiscoveryMessage } from '../../services/discoveryService'
import { STATUS_LABELS } from '../../lib/constants'
import { getProject, updateProjectDiscovery } from '../../services/projectsService'
import { mergeDiscoveryRequirements } from '../../services/requirementsService'
import { useNewProjectFlow } from './useNewProjectFlow'
import { usePrdGeneration } from './usePrdGeneration'

const DISCOVERY_ERROR_FALLBACK = 'ما قدرت أحلل الإجابة حالياً. حاول مرة ثانية.'

/**
 * Builds the AI-facing conversation history from the chat's display
 * messages. Wizard Q&A bubbles (name/client/type/description prompts —
 * see useNewProjectFlow.js) are scripted UI, not part of the real Gemini
 * conversation, and are identifiable by their client-only `wizard-*` id
 * (they're never persisted to the `messages` table, so this filter is a
 * no-op once a project has been reloaded from the database).
 */
function buildDiscoveryHistory(displayMessages, extraTurn) {
  const real = displayMessages
    .filter((message) => !String(message.id).startsWith('wizard-'))
    .map((message) => ({ role: message.role, content: message.content }))
  return extraTurn ? [...real, extraTurn] : real
}

/**
 * Single routed component for /chat, /chat/new and /chat/:projectId
 * (Sections 6-11). Which sub-view renders is a plain conditional on the
 * route param, not a hook — each branch is its own component so hooks
 * inside them are still called unconditionally per render, satisfying
 * rules-of-hooks.
 */
export function ChatPage() {
  const { projectId } = useParams()
  const { organizationId, projects, projectsLoading, refetchProjects } = useOutletContext()

  if (!projectId) {
    return <ChatIndex projects={projects} loading={projectsLoading} />
  }
  if (projectId === 'new') {
    return <NewProjectChat organizationId={organizationId} refetchProjects={refetchProjects} />
  }
  return <ExistingProjectChat projectId={projectId} organizationId={organizationId} />
}

/** First-time user: quiet empty state. Existing user: redirect to their most-recently-updated project. */
function ChatIndex({ projects, loading }) {
  if (loading) {
    return <div className="page-loading">جارٍ التحميل…</div>
  }

  if (projects.length === 0) {
    return (
      <div className="chat-empty">
        <p className="chat-empty-eyebrow">أهلاً بك في أريب.</p>
        <h1 className="chat-empty-title">خلينا نفهم مشروعك.</h1>
        <Link to="/chat/new" className="btn btn-primary">
          ابدأ مشروع جديد
        </Link>
      </div>
    )
  }

  return <Navigate to={`/chat/${projects[0].id}`} replace />
}

/** The scripted (non-AI) new-project onboarding chat (Section 11). */
function NewProjectChat({ organizationId, refetchProjects }) {
  const navigate = useNavigate()
  const flow = useNewProjectFlow(organizationId)

  useEffect(() => {
    if (!flow.createdProject) return
    refetchProjects()
    // Carry the wizard's own messages across the redirect via router state
    // — see useMessages' seedMessages param for why: on a not-yet-migrated
    // `messages` table, the DB-backed fetch on the other side comes back
    // empty and would otherwise make these messages vanish instead of ever
    // reaching the user. `autoStartDiscovery` tells ExistingProjectChat to
    // kick off the FIRST real Gemini discovery turn using the project's
    // own description as soon as it loads, instead of showing a canned
    // "coming later" placeholder.
    navigate(`/chat/${flow.createdProject.id}`, {
      replace: true,
      state: { seedMessages: flow.messages, autoStartDiscovery: true },
    })
  }, [flow.createdProject, flow.messages, navigate, refetchProjects])

  return (
    <Chat
      messages={flow.messages}
      onSend={flow.submitAnswer}
      quickReplies={flow.chipOptions}
      onQuickReply={flow.submitAnswer}
      placeholder={flow.currentQuestion?.placeholder || 'احكي لي عن مشروعك...'}
      disabled={flow.creating || !!flow.createdProject}
      thinking={flow.creating}
      thinkingLabel="جارٍ إنشاء المشروع…"
      error={flow.error}
    />
  )
}

/** An existing project's persisted chat history, now wired to the real Gemini discovery agent (Sections 8, 19-24). */
function ExistingProjectChat({ projectId, organizationId }) {
  const location = useLocation()
  const seedMessages = location.state?.seedMessages ?? null
  const autoStartDiscovery = location.state?.autoStartDiscovery ?? false
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const { messages, loading: messagesLoading, isMissingTable, addMessage } = useMessages(projectId, seedMessages)
  const [discovery, setDiscovery] = useState({ loading: false, error: null, pendingHistory: null, ready: false })
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (!organizationId) return undefined
    let mounted = true
    setLoading(true)
    setNotFound(false)

    getProject(projectId, organizationId).then(({ data, error }) => {
      if (!mounted) return
      if (error || !data) {
        setNotFound(true)
      } else {
        setProject(data)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [projectId, organizationId])

  /**
   * Sends `history` to the discovery API, shows the thinking indicator
   * while waiting, and on success renders + persists Gemini's real reply
   * plus the latest confidence/discovery_state snapshot. On failure, keeps
   * `history` around so the Retry button can resend the exact same
   * request without re-appending the user's message a second time.
   */
  const runDiscovery = useCallback(
    async (history) => {
      setDiscovery({ loading: true, error: null, pendingHistory: history, ready: false })
      const { data, error } = await sendDiscoveryMessage(projectId, history)

      if (error || !data) {
        setDiscovery({ loading: false, error: error || DISCOVERY_ERROR_FALLBACK, pendingHistory: history, ready: false })
        return
      }

      addMessage('assistant', data.response)

      // `status` moves with the agent's own verdict, not on its own timer:
      // 'ready' means Areeb says it understands the idea, which is exactly
      // what 'ready_for_review' represents in the schema's enum. Without
      // this the status pill (and the sidebar's per-project meta line) sat
      // on 'الاكتشاف' forever, no matter how complete the project was.
      const ready = data.discovery_status === 'ready'
      setDiscovery({ loading: false, error: null, pendingHistory: null, ready })

      const discoveryState = {
        requirements_extracted: data.requirements_extracted || [],
        missing_information: data.missing_information || [],
        contradictions: data.contradictions || [],
        discovery_status: data.discovery_status,
        intent: data.intent,
      }

      // Mirror the write locally too — the project row was fetched once on
      // mount and is never refetched, so without this the header's status
      // pill and the "راجع المتطلبات / PRD" affordances keep showing the
      // state the project was in when the page loaded.
      setProject((current) =>
        current
          ? {
              ...current,
              confidence: typeof data.confidence === 'number' ? data.confidence : current.confidence,
              discovery_state: discoveryState,
              status: ready && current.status === 'discovery' ? 'ready_for_review' : current.status,
            }
          : current,
      )

      updateProjectDiscovery(projectId, {
        confidence: typeof data.confidence === 'number' ? data.confidence : 0,
        status: ready ? 'ready_for_review' : undefined,
        discovery_state: discoveryState,
      }).then(({ error: persistError }) => {
        // Best-effort — an unmigrated `projects.confidence`/`discovery_state`
        // (schema migration not yet run) degrades to "not saved this turn"
        // rather than crashing, same spirit as the messages-table precedent.
        if (persistError) {
          console.warn('[areep] could not persist discovery state (likely unmigrated columns):', persistError.message)
        }
      })

      // Normalizes this turn's requirements_extracted into the real
      // `requirements` table (spec section 9) — independent of the raw
      // snapshot write above, best-effort, never blocks the chat UI.
      mergeDiscoveryRequirements(projectId, data.requirements_extracted || []).catch((mergeError) => {
        console.warn('[areep] requirements merge failed:', mergeError?.message || mergeError)
      })
    },
    [projectId, addMessage],
  )

  // Fires once, right after the new-project wizard hands off here: sends
  // the project's own description as the FIRST real discovery turn
  // (not the wizard's meta Q&A) so Gemini's actual first follow-up
  // question replaces the old hardcoded placeholder line. The description
  // is persisted directly (not via addMessage) so it isn't shown twice —
  // the wizard's own "احكي لي عنه..." bubble already displays it this
  // session; on a future reload the DB-persisted turn is what renders.
  useEffect(() => {
    if (!autoStartDiscovery || !project || autoStartedRef.current) return
    const description = project.description?.trim()
    if (!description) return
    autoStartedRef.current = true
    insertMessage(projectId, 'user', description).catch(() => {})
    runDiscovery([{ role: 'user', content: description }])
  }, [autoStartDiscovery, project, projectId, runDiscovery])

  const handleSend = useCallback(
    (text) => {
      const trimmed = typeof text === 'string' ? text.trim() : ''
      if (!trimmed || discovery.loading) return
      addMessage('user', trimmed)
      runDiscovery(buildDiscoveryHistory(messages, { role: 'user', content: trimmed }))
    },
    [addMessage, discovery.loading, messages, runDiscovery],
  )

  const handleRetry = useCallback(() => {
    if (discovery.pendingHistory) runDiscovery(discovery.pendingHistory)
  }, [discovery.pendingHistory, runDiscovery])

  // Requirements aren't loaded on this screen, so the hook reads them
  // itself (table first, discovery_state snapshot second) — see
  // usePrdGeneration.js.
  const prd = usePrdGeneration(projectId, project, null)

  /**
   * `discovery.ready` only covers the turn that just came back over the
   * wire. `discovery_state.discovery_status` is the same verdict as
   * persisted last turn, so reading both means the action survives a
   * reload — and doesn't vanish the moment the user types one more
   * message after Areeb already said it understood the idea.
   */
  const readyForPrd = discovery.ready || project?.discovery_state?.discovery_status === 'ready' || project?.status === 'ready_for_review'

  if (loading) {
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
        <ProjectTabs projectId={projectId} showPrd={project.status === 'prd_generated'} />
      </header>

      {isMissingTable && (
        <div className="notice notice-inline" role="status">
          <p className="text-secondary">
            سجلّ المحادثة غير مفعّل بعد لهذا المشروع (جدول <code>messages</code> غير موجود في قاعدة البيانات) — الرسائل
            ستُعرض هنا لهذه الجلسة فقط.
          </p>
        </div>
      )}

      <Chat
        messages={messagesLoading ? [] : messages}
        onSend={handleSend}
        placeholder="اكتب رسالتك..."
        disabled={discovery.loading}
        thinking={discovery.loading}
        thinkingLabel="أريب يحلل إجابتك..."
        error={discovery.error || prd.error}
        onRetry={discovery.error ? handleRetry : undefined}
        readyForReview={readyForPrd && !discovery.loading}
        reviewHref={`/chat/${projectId}/requirements`}
        onGeneratePrd={prd.generate}
        generatingPrd={prd.generating}
      />
    </div>
  )
}

/**
 * Small pill switcher shared by the chat view and the Requirements
 * Review view (spec section 25: "review inside the same workspace, don't
 * jump to a separate page") so moving between them reads as one
 * workspace, not two apps. Exported for RequirementsReview.jsx to reuse
 * the exact same header row.
 */
export function ProjectTabs({ projectId, showPrd = false }) {
  return (
    <nav className="project-tabs" aria-label="أقسام المشروع">
      <NavLink to={`/chat/${projectId}`} end className={({ isActive }) => `project-tab${isActive ? ' active' : ''}`}>
        المحادثة
      </NavLink>
      <NavLink to={`/chat/${projectId}/requirements`} className={({ isActive }) => `project-tab${isActive ? ' active' : ''}`}>
        المتطلبات
      </NavLink>
      {/* Only shown once a PRD has actually been generated for this
          project (projects.status flips to 'prd_generated' — an enum
          value that was already in the check constraint since the
          Phase 1 schema, see supabase/schema.sql) — never a dead tab. */}
      {showPrd && (
        <NavLink to={`/chat/${projectId}/prd`} className={({ isActive }) => `project-tab${isActive ? ' active' : ''}`}>
          PRD
        </NavLink>
      )}
    </nav>
  )
}
