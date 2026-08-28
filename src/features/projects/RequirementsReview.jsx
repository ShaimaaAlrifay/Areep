import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useProject } from '../../hooks/useProject'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  REQUIREMENT_TYPE_LABELS,
  REQUIREMENT_TYPE_ORDER,
  STATUS_LABELS,
} from '../../lib/constants'
import { groupRequirementsByType, requirementsFromDiscoveryState } from '../../lib/requirementGroups'
import { addRequirement, deleteRequirement, isMissingTableError, listRequirements, updateRequirement } from '../../services/requirementsService'
import { ProjectTabs } from './ChatPage'
import { usePrdGeneration } from './usePrdGeneration'

const PRIORITY_BADGE_CLASS = {
  'Must Have': 'priority-badge-must',
  'Should Have': 'priority-badge-should',
}

/**
 * Requirements Review (spec sections 25-26) — a workspace view swap next
 * to the discovery chat (see ProjectTabs, shared with ChatPage.jsx), not
 * a separate page. Normally reads/writes the normalized `requirements`
 * table; degrades to a read-only view of `project.discovery_state`'s raw
 * jsonb snapshot when that table hasn't been migrated yet or hasn't been
 * populated for this project yet — see `usingFallback` below.
 */
export function RequirementsReview() {
  const { projectId } = useParams()
  const { organizationId } = useOutletContext()
  const { project, loading: projectLoading, notFound } = useProject(projectId, organizationId)
  const [requirements, setRequirements] = useState([])
  const [reqLoading, setReqLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  const loadRequirements = useCallback(() => {
    setReqLoading(true)
    listRequirements(projectId).then(({ data, error }) => {
      if (error) {
        if (isMissingTableError(error)) {
          setTableMissing(true)
          setRequirements([])
        } else {
          console.warn('[areep] could not load requirements:', error.message)
          setRequirements([])
        }
      } else {
        setTableMissing(false)
        setRequirements(data || [])
      }
      setReqLoading(false)
    })
  }, [projectId])

  useEffect(() => {
    loadRequirements()
  }, [loadRequirements])

  const fallbackItems = useMemo(() => requirementsFromDiscoveryState(project), [project])

  // Only fall back once we actually know the real table is empty (not
  // just "still loading") — otherwise every page load would flash the
  // fallback before the real fetch resolves.
  const usingFallback = tableMissing || (!reqLoading && requirements.length === 0 && fallbackItems.length > 0)
  const items = usingFallback ? fallbackItems : requirements
  const editable = !usingFallback

  const bySection = useMemo(() => groupRequirementsByType(items), [items])

  const handleSave = useCallback((id, values) => {
    return updateRequirement(id, values).then(({ data, error }) => {
      if (error) {
        console.warn('[areep] could not save requirement edit:', error.message)
        return false
      }
      setRequirements((current) => current.map((row) => (row.id === id ? data : row)))
      return true
    })
  }, [])

  const handleDelete = useCallback((id) => {
    if (!window.confirm('حذف هذا المتطلب نهائيًا؟')) return
    deleteRequirement(id).then(({ error }) => {
      if (error) {
        console.warn('[areep] could not delete requirement:', error.message)
        return
      }
      setRequirements((current) => current.filter((row) => row.id !== id))
    })
  }, [])

  const handleAdd = useCallback(
    (type, values) => {
      return addRequirement(projectId, { type, ...values }).then(({ data, error }) => {
        if (error) {
          console.warn('[areep] could not add requirement:', error.message)
          return false
        }
        setRequirements((current) => [...current, data])
        return true
      })
    },
    [projectId],
  )

  // Same flow the chat's "جهّز وثيقة PRD" action runs — generate, persist,
  // export through Areeb's own PDF template, then land on the preview.
  // Shared so the two entry points can't diverge (see usePrdGeneration.js);
  // this one passes the requirements it has already loaded, so the hook
  // doesn't re-read them.
  const prdState = usePrdGeneration(projectId, project, bySection)

  if (projectLoading) {
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

  const missingInfo = Array.isArray(project.discovery_state?.missing_information) ? project.discovery_state.missing_information : []
  const confidence = typeof project.confidence === 'number' ? project.confidence : 0

  return (
    <div className="chat-with-header">
      <header className="chat-header">
        <div className="chat-header-title-row">
          <h1>{project.name}</h1>
          <span className="chat-header-status">{STATUS_LABELS[project.status] || project.status}</span>
        </div>
        <ProjectTabs projectId={projectId} showPrd={project.status === 'prd_generated'} />
      </header>

      <div className="requirements-page">
        <div className="requirements-column">
          {tableMissing && (
            <div className="notice notice-inline" role="status">
              <p className="text-secondary requirements-fallback-notice">
                جدول <code>requirements</code> غير مفعّل بعد في قاعدة البيانات — المعروض أدناه آخر نسخة محفوظة من المحادثة
                فقط (للقراءة فقط، بدون تعديل/حذف/إضافة حتى يتم تطبيق الترحيل).
              </p>
            </div>
          )}
          {!tableMissing && usingFallback && (
            <div className="notice notice-inline" role="status">
              <p className="text-secondary requirements-fallback-notice">
                لسه ما انحفظت متطلبات منظّمة لهذا المشروع — المعروض أدناه آخر نسخة من المحادثة (للقراءة فقط مؤقتًا).
              </p>
            </div>
          )}

          <div className="req-confidence">
            <div className="req-confidence-row">
              <span className="req-confidence-label">نسبة الثقة</span>
              <span className="req-confidence-value ltr-nums">{confidence}%</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${confidence}%` }} />
            </div>
          </div>

          {REQUIREMENT_TYPE_ORDER.map((type) => (
            <RequirementSection
              key={type}
              type={type}
              items={bySection[type]}
              editable={editable}
              onSave={handleSave}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          ))}

          <section className="req-section">
            <h2 className="req-section-title">أسئلة مفتوحة</h2>
            {missingInfo.length === 0 ? (
              <p className="req-section-empty">لا يوجد</p>
            ) : (
              <ul className="req-list">
                {missingInfo.map((question, index) => (
                  <li key={index} className="req-item">
                    <p className="req-description">{question}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="requirements-generate">
            <button type="button" className="btn btn-primary" onClick={prdState.generate} disabled={prdState.generating || items.length === 0}>
              {prdState.generating ? 'أريب يبني وثيقتك…' : 'توليد PRD'}
            </button>
            {items.length === 0 && !prdState.generating && <p className="form-note">أضف متطلبات أولًا قبل توليد وثيقة PRD.</p>}
            {prdState.error && (
              <div className="chat-inline-error-wrap">
                <p className="form-error chat-inline-error">{prdState.error}</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={prdState.generate}>
                  حاول مرة ثانية
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RequirementSection({ type, items, editable, onSave, onDelete, onAdd }) {
  const [adding, setAdding] = useState(false)

  return (
    <section className="req-section">
      <h2 className="req-section-title">{REQUIREMENT_TYPE_LABELS[type]}</h2>

      {items.length === 0 && !adding && <p className="req-section-empty">لا يوجد</p>}

      {items.length > 0 && (
        <ul className="req-list">
          {items.map((item) => (
            <RequirementRow key={item.id || item.req_key} item={item} editable={editable} onSave={onSave} onDelete={onDelete} />
          ))}
        </ul>
      )}

      {editable && !adding && (
        <button type="button" className="req-add-toggle" onClick={() => setAdding(true)}>
          + إضافة
        </button>
      )}

      {editable && adding && (
        <RequirementAddForm
          onCancel={() => setAdding(false)}
          onSubmit={(values) =>
            onAdd(type, values).then((ok) => {
              if (ok) setAdding(false)
            })
          }
        />
      )}
    </section>
  )
}

function RequirementRow({ item, editable, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="req-item">
        <RequirementEditForm
          item={item}
          onCancel={() => setEditing(false)}
          onSubmit={(values) =>
            onSave(item.id, values).then((ok) => {
              if (ok) setEditing(false)
            })
          }
        />
      </li>
    )
  }

  return (
    <li className="req-item">
      <div className="req-item-head">
        <span className="req-key">{item.req_key}</span>
        <span className="req-title">{item.title}</span>
        <span className={`priority-badge ${PRIORITY_BADGE_CLASS[item.priority] || ''}`}>{PRIORITY_LABELS[item.priority] || item.priority}</span>
        {editable && (
          <div className="req-item-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
              تعديل
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onDelete(item.id)}>
              حذف
            </button>
          </div>
        )}
      </div>
      {item.description && <p className="req-description">{item.description}</p>}
    </li>
  )
}

function RequirementEditForm({ item, onCancel, onSubmit }) {
  const [title, setTitle] = useState(item.title || '')
  const [description, setDescription] = useState(item.description || '')
  const [priority, setPriority] = useState(item.priority || 'Unspecified')
  const [saving, setSaving] = useState(false)

  const submit = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || saving) return
    setSaving(true)
    onSubmit({ title: trimmedTitle, description: description.trim(), priority }).finally(() => setSaving(false))
  }

  return (
    <div className="req-edit-form">
      <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={submit} placeholder="العنوان" />
      <textarea
        className="textarea"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onBlur={submit}
        placeholder="الوصف"
        rows={2}
      />
      <div className="req-form-row">
        <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)}>
          {PRIORITY_ORDER.map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="req-form-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>
          حفظ
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  )
}

function RequirementAddForm({ onCancel, onSubmit }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Unspecified')
  const [saving, setSaving] = useState(false)

  const submit = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || saving) return
    setSaving(true)
    onSubmit({ title: trimmedTitle, description: description.trim(), priority }).finally(() => setSaving(false))
  }

  return (
    <div className="req-add-form">
      <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="العنوان" autoFocus />
      <textarea
        className="textarea"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="الوصف (اختياري)"
        rows={2}
      />
      <div className="req-form-row">
        <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)}>
          {PRIORITY_ORDER.map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="req-form-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={saving || !title.trim()}>
          إضافة
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  )
}
