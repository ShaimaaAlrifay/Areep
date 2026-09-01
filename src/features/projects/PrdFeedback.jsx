import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { EVENTS, track } from '../../lib/analytics'
import {
  EDIT_LEVEL,
  NEGATIVE_REASONS,
  POSITIVE_REASONS,
  REQUIREMENT_ACCURACY,
  REQUIREMENT_COMPLETENESS,
  VALUE_RATING,
} from '../../lib/prdFeedbackOptions'
import { getMyPrdFeedback, isMissingTableError, savePrdFeedbackStep, submitPrdFeedback } from '../../services/prdFeedbackService'

const STARS = [1, 2, 3, 4, 5]

/**
 * Quiet, inline, progressive-disclosure feedback panel shown after a PRD
 * is displayed (fresh generation or a reload — see PrdPreview.jsx). Never
 * a modal (spec section 01). Every step upserts to `prd_feedback`
 * immediately (progressive save); only the final star-rating step is
 * awaited, since that's the one moment the user is told "تم".
 *
 * Mid-flow position is deliberately not restored across a reload — a
 * partial draft's answers are still saved (useful signal on their own),
 * but the UI always restarts at step 1 next time. What must never repeat
 * (a duplicate final submission) is prevented by `submitted_at`, checked
 * on mount below.
 */
export function PrdFeedback({ projectId }) {
  const [phase, setPhase] = useState('loading') // loading | form | submitted | conflict | unavailable
  const [step, setStep] = useState(1)
  const [sentiment, setSentiment] = useState(null)
  const [reasons, setReasons] = useState([])
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState(false)
  const [requirementAccuracy, setRequirementAccuracy] = useState(null)
  const [requirementCompleteness, setRequirementCompleteness] = useState(null)
  const [editLevel, setEditLevel] = useState(null)
  const [valueRating, setValueRating] = useState(null)
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const userIdRef = useRef(null)
  const openedTrackedRef = useRef(false)

  useEffect(() => {
    if (!supabase || !projectId) {
      setPhase('unavailable')
      return undefined
    }
    let mounted = true
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!mounted) return
      userIdRef.current = userData?.user?.id || null

      const { data, error } = await getMyPrdFeedback(projectId)
      if (!mounted) return
      if (error) {
        if (isMissingTableError(error)) {
          console.warn('[areep] prd_feedback table not migrated yet — hiding feedback panel.')
          setPhase('unavailable')
        } else {
          console.warn('[areep] could not load prd feedback:', error.message)
          setPhase('unavailable')
        }
        return
      }
      if (data?.submitted_at) {
        setPhase('submitted')
        return
      }
      setPhase('form')
    })()
    return () => {
      mounted = false
    }
  }, [projectId])

  useEffect(() => {
    if (phase === 'form' && step === 1 && !openedTrackedRef.current) {
      openedTrackedRef.current = true
      track(EVENTS.PRD_FEEDBACK_OPENED, {})
    }
  }, [phase, step])

  function saveStep(patch) {
    if (!userIdRef.current) return
    savePrdFeedbackStep(projectId, userIdRef.current, patch).then(({ error }) => {
      if (error?.kind === 'missing_table') setPhase('unavailable')
      else if (error?.kind === 'conflict') setPhase('conflict')
      else if (error) console.warn('[areep] could not save prd feedback step:', error.raw?.message)
    })
  }

  function chooseSentiment(value) {
    setSentiment(value)
    saveStep({ sentiment: value })
    track(value === 'positive' ? EVENTS.PRD_FEEDBACK_POSITIVE : EVENTS.PRD_FEEDBACK_NEGATIVE, {})
    setStep(2)
  }

  function toggleReason(value) {
    setReasons((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]))
    track(EVENTS.PRD_FEEDBACK_REASON_SELECTED, { sentiment })
    if (commentError) setCommentError(false)
  }

  function continueFromReasons() {
    const needsComment = sentiment === 'negative' && reasons.includes('other')
    if (needsComment && !comment.trim()) {
      setCommentError(true)
      return
    }
    const trimmed = comment.trim() || null
    saveStep({
      [sentiment === 'positive' ? 'positive_reasons' : 'negative_reasons']: reasons,
      comment: trimmed,
    })
    if (trimmed) track(EVENTS.PRD_FEEDBACK_COMMENT_ADDED, { hasComment: true })
    setStep(3)
  }

  function chooseAccuracy(value) {
    setRequirementAccuracy(value)
    saveStep({ requirement_accuracy: value })
    setStep(4)
  }

  function chooseCompleteness(value) {
    setRequirementCompleteness(value)
    saveStep({ requirement_completeness: value })
    setStep(5)
  }

  function chooseEditLevel(value) {
    setEditLevel(value)
    saveStep({ edit_level: value })
    setStep(6)
  }

  function chooseValueRating(value) {
    setValueRating(value)
    saveStep({ value_rating: value })
    setStep(7)
  }

  async function handleSubmit() {
    if (!rating || !userIdRef.current) return
    setSubmitting(true)
    const { error } = await submitPrdFeedback(projectId, userIdRef.current, { rating })
    setSubmitting(false)
    if (error?.kind === 'conflict') {
      setPhase('conflict')
      return
    }
    if (error) {
      console.warn('[areep] could not submit prd feedback:', error.raw?.message)
      return
    }
    track(EVENTS.PRD_FEEDBACK_SUBMITTED, { sentiment, rating })
    setPhase('submitted')
  }

  if (phase === 'loading' || phase === 'unavailable') return null

  if (phase === 'conflict') {
    return (
      <div className="prd-feedback">
        <p className="prd-feedback-done">هذي الوثيقة قُيِّمت من عضو آخر بالفريق.</p>
      </div>
    )
  }

  if (phase === 'submitted') {
    return (
      <div className="prd-feedback">
        <p className="prd-feedback-done">✓ تم تسجيل تقييمك — شكرًا، تقييمك يساعد أريب يتحسن.</p>
      </div>
    )
  }

  const reasonList = sentiment === 'positive' ? POSITIVE_REASONS : NEGATIVE_REASONS
  const needsCommentForOther = sentiment === 'negative' && reasons.includes('other')

  return (
    <div className="prd-feedback">
      <p className="prd-feedback-prompt">كيف كانت نتيجة أريب؟</p>

      {step === 1 && (
        <>
          <p className="prd-feedback-question">هل الـPRD الناتج يعكس فكرتك بشكل صحيح؟</p>
          <div className="prd-feedback-thumbs">
            <button type="button" className="prd-feedback-thumb" onClick={() => chooseSentiment('positive')}>
              👍 ممتاز
            </button>
            <button type="button" className="prd-feedback-thumb" onClick={() => chooseSentiment('negative')}>
              👎 يحتاج تحسين
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="prd-feedback-step">
          <p className="prd-feedback-question">{sentiment === 'positive' ? 'وش اللي أعجبك في النتيجة؟' : 'وش اللي يحتاج تحسين؟'}</p>
          <div className="prd-feedback-options">
            {reasonList.map((option) => (
              <label key={option.value} className={`prd-feedback-option${reasons.includes(option.value) ? ' is-selected' : ''}`}>
                <input type="checkbox" checked={reasons.includes(option.value)} onChange={() => toggleReason(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
          <textarea
            className="prd-feedback-comment"
            placeholder={sentiment === 'positive' ? 'أي ملاحظة إضافية؟ (اختياري)' : 'اكتب لنا باختصار وش اللي كان غلط أو ناقص...'}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              if (commentError) setCommentError(false)
            }}
          />
          {needsCommentForOther && commentError && <p className="form-error">وضح لنا المشكلة قبل المتابعة.</p>}
          <div className="prd-feedback-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={continueFromReasons}>
              التالي
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="prd-feedback-step">
          <p className="prd-feedback-question">كيف كانت المتطلبات التي استخرجها أريب؟</p>
          <div className="prd-feedback-options">
            {REQUIREMENT_ACCURACY.map((option) => (
              <label key={option.value} className={`prd-feedback-option${requirementAccuracy === option.value ? ' is-selected' : ''}`}>
                <input type="radio" name="requirement_accuracy" checked={requirementAccuracy === option.value} onChange={() => chooseAccuracy(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="prd-feedback-step">
          <p className="prd-feedback-question">هل كانت المتطلبات كاملة؟</p>
          <div className="prd-feedback-options">
            {REQUIREMENT_COMPLETENESS.map((option) => (
              <label key={option.value} className={`prd-feedback-option${requirementCompleteness === option.value ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="requirement_completeness"
                  checked={requirementCompleteness === option.value}
                  onChange={() => chooseCompleteness(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="prd-feedback-step">
          <p className="prd-feedback-question">هل احتجت تعدّل النتيجة قبل اعتمادها؟</p>
          <div className="prd-feedback-options">
            {EDIT_LEVEL.map((option) => (
              <label key={option.value} className={`prd-feedback-option${editLevel === option.value ? ' is-selected' : ''}`}>
                <input type="radio" name="edit_level" checked={editLevel === option.value} onChange={() => chooseEditLevel(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="prd-feedback-step">
          <p className="prd-feedback-question">هل ساعدك أريب في الوصول لنتيجة أفضل أو أسرع؟</p>
          <div className="prd-feedback-options">
            {VALUE_RATING.map((option) => (
              <label key={option.value} className={`prd-feedback-option${valueRating === option.value ? ' is-selected' : ''}`}>
                <input type="radio" name="value_rating" checked={valueRating === option.value} onChange={() => chooseValueRating(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="prd-feedback-step">
          <p className="prd-feedback-question">كيف تقيّم تجربتك مع أريب؟</p>
          <div className="prd-feedback-stars" role="radiogroup" aria-label="التقييم من 1 إلى 5">
            {STARS.map((n) => (
              <button
                key={n}
                type="button"
                className={`prd-feedback-star${n <= rating ? ' is-filled' : ''}`}
                aria-label={`${n} من 5`}
                onClick={() => setRating(n)}
              >
                ★
              </button>
            ))}
          </div>
          <div className="prd-feedback-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={!rating || submitting} onClick={handleSubmit}>
              إرسال التقييم
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
