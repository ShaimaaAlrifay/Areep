import { useCallback, useState } from 'react'
import { PROJECT_TYPE_LABELS, PROJECT_TYPE_ORDER } from '../../lib/constants'
import { createProject } from './createProject'

// The scripted (non-AI) new-project onboarding script — Section 11. One
// question at a time, waiting for the user's reply before advancing.
// `projectType` renders as quick-reply chips instead of free text so it
// maps cleanly onto projects.project_type's fixed enum without needing an
// intent parser (explicitly out of scope this phase).
const QUESTIONS = [
  { key: 'name', prompt: 'خلينا نبدأ مشروع جديد. إيش اسم المشروع؟', placeholder: 'مثال: تطبيق إدارة المخزون' },
  { key: 'clientName', prompt: 'مين العميل؟', placeholder: 'اسم العميل (اختياري)', skippable: true },
  { key: 'projectType', prompt: 'إيش نوع المشروع؟', chips: true },
  { key: 'description', prompt: 'احكي لي عنه بشكل مختصر.', placeholder: 'جملة أو جملتين عن هدف المشروع' },
]

let idCounter = 0
function nextId() {
  idCounter += 1
  return `wizard-${idCounter}`
}

/**
 * Drives the scripted new-project chat. Nothing here is persisted to
 * `messages` until a real project row exists (its foreign key requires
 * one) — the wizard's own back-and-forth is local/ephemeral by design,
 * only the final closing message gets written to the database, against
 * the freshly-created project id.
 */
export function useNewProjectFlow(organizationId) {
  const [messages, setMessages] = useState(() => [{ id: nextId(), role: 'assistant', content: QUESTIONS[0].prompt }])
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [createdProject, setCreatedProject] = useState(null)

  const currentQuestion = QUESTIONS[stepIndex] ?? null

  const pushMessage = useCallback((role, content) => {
    setMessages((current) => [...current, { id: nextId(), role, content }])
  }, [])

  const finish = useCallback(
    async (finalAnswers) => {
      setCreating(true)
      setError(null)
      try {
        const project = await createProject({
          organizationId,
          name: finalAnswers.name,
          clientName: finalAnswers.clientName,
          projectType: finalAnswers.projectType,
          description: finalAnswers.description,
        })

        // No scripted closing line anymore — the wizard hands off straight
        // to ExistingProjectChat, which auto-sends `project.description`
        // as the real first discovery turn to Gemini (see ChatPage.jsx's
        // autoStartDiscovery effect) and shows Gemini's actual first
        // follow-up question instead of a canned placeholder.
        setCreatedProject(project)
      } catch (submitError) {
        setError(submitError?.message || 'تعذّر إنشاء المشروع. حاول مرة أخرى.')
      } finally {
        setCreating(false)
      }
    },
    [organizationId],
  )

  const submitAnswer = useCallback(
    (rawValue) => {
      if (!currentQuestion || creating) return
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue
      if (currentQuestion.key !== 'clientName' && !value) return

      const displayText = currentQuestion.chips ? PROJECT_TYPE_LABELS[value] || value : value || 'بدون'
      pushMessage('user', displayText)

      const nextAnswers = { ...answers, [currentQuestion.key]: value }
      setAnswers(nextAnswers)

      const nextIndex = stepIndex + 1
      if (nextIndex < QUESTIONS.length) {
        setStepIndex(nextIndex)
        pushMessage('assistant', QUESTIONS[nextIndex].prompt)
      } else {
        finish(nextAnswers)
      }
    },
    [answers, creating, currentQuestion, finish, pushMessage, stepIndex],
  )

  const chipOptions = currentQuestion?.chips
    ? PROJECT_TYPE_ORDER.map((type) => ({ value: type, label: PROJECT_TYPE_LABELS[type] }))
    : currentQuestion?.skippable
      ? [{ value: '', label: 'بدون' }]
      : null

  return {
    messages,
    currentQuestion,
    chipOptions,
    creating,
    error,
    createdProject,
    submitAnswer,
  }
}
