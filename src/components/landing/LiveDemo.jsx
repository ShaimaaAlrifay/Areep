import { useCallback, useEffect, useRef, useState } from 'react'
import { useInView } from '../../hooks/useInView'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/* ============================================================
   "Watch it think" — the page's interactive centrepiece.

   A visitor should not read a description of the discovery agent; they
   should watch one run. So this replays a real session shape: a founder
   sentence goes in, and what comes back is exactly what the live agent
   returns — a reply, a confidence score, requirements typed and numbered
   with the product's own prefixes (GOAL / USER / FEAT / FR / NFR / RISK /
   ASM), and the list of what it noticed is still missing.

   Two honesty constraints this deliberately respects:

   1. It is a replay, not a live model call, and it says so on screen.
      Wiring the landing page to /api/discovery would hand an unauthenticated
      endpoint to every visitor and burn the project's API quota — the
      backend is rate-limited by nothing today. Faking a live call without
      saying so would be worse still.
   2. The content is real product output, not marketing copy. The
      requirement ids, the seven types, the MoSCoW values and the
      confidence scale all match server/prompts/gemini/discovery.system.js.
      Nothing here claims a capability the product does not have.
   ============================================================ */

const SCENARIOS = [
  {
    id: 'study',
    prompt: 'أبغى أبني تطبيق يساعد الطلاب ينظمون مذاكرتهم',
    reply:
      'حلو، بس خلّنا ما نستعجل بالحل. مين الطالب اللي تقصده؟ جامعي عنده مواد كثيرة، ولا ثانوي يجهّز لاختبار؟ ووش أكثر شي معطّله اليوم؟',
    confidence: 34,
    requirements: [
      { id: 'GOAL-001', type: 'الهدف', title: 'تنظيم وقت المذاكرة', priority: 'إلزامي' },
      { id: 'USER-001', type: 'مستخدم', title: 'طالب — لسه الفئة ما تحددت', priority: 'غير محدد' },
    ],
    missing: ['مين الفئة بالضبط', 'وش يضيّع وقت الطالب فعليًا', 'المشكلة في التخطيط ولا في الالتزام'],
  },
  {
    id: 'clinic',
    prompt: 'عندي عيادة وأبغى نظام مواعيد يقلل الغياب',
    reply:
      'واضح. الغياب عادة له سببين: إما نسيان، أو إن التأجيل صعب. أي واحد فيهم أكثر عندك؟ وكم موعد يجيك باليوم عشان أعرف حجم النظام؟',
    confidence: 48,
    requirements: [
      { id: 'GOAL-001', type: 'الهدف', title: 'تقليل نسبة الغياب عن المواعيد', priority: 'إلزامي' },
      { id: 'USER-001', type: 'مستخدم', title: 'مريض يحجز موعدًا', priority: 'إلزامي' },
      { id: 'FEAT-001', type: 'ميزة', title: 'نظام حجز وتذكير بالمواعيد', priority: 'إلزامي' },
      { id: 'RISK-001', type: 'خطر', title: 'قد لا يقرأ المريض التذكير', priority: 'غير محدد' },
    ],
    missing: ['وش السبب الأغلب للغياب', 'كم موعد باليوم', 'وين يوصله التذكير'],
  },
  {
    id: 'store',
    prompt: 'محل عندي، أبغى الزباين يطلبون أونلاين بدل الواتساب',
    reply:
      'يعني المشكلة مو بالمبيعات، المشكلة إن الطلبات كلها بالواتساب وتضيع. صح؟ كم طلب يوصلك باليوم، ومين اللي يرد عليهم الحين؟',
    confidence: 52,
    requirements: [
      { id: 'GOAL-001', type: 'الهدف', title: 'نقل الطلبات من الواتساب لمسار منظّم', priority: 'إلزامي' },
      { id: 'USER-001', type: 'مستخدم', title: 'زبون يطلب من المحل', priority: 'إلزامي' },
      { id: 'FR-001', type: 'متطلب', title: 'سلة طلب وتأكيد', priority: 'إلزامي' },
      { id: 'NFR-001', type: 'غير وظيفي', title: 'يعمل على الجوال أساسًا', priority: 'مفضّل' },
    ],
    missing: ['كم طلب باليوم', 'مين يدير الطلبات الحين', 'فيه دفع إلكتروني ولا لا'],
  },
]

const PHASES = { IDLE: 'idle', TYPING: 'typing', THINKING: 'thinking', ANSWERED: 'answered' }

export function LiveDemo() {
  const [ref, inView] = useInView({ threshold: 0.3 })
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState(PHASES.IDLE)
  const [revealed, setRevealed] = useState(0)
  const timers = useRef([])

  const scenario = SCENARIOS[index]

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const run = useCallback(
    (scene) => {
      clearTimers()
      const after = (ms, fn) => timers.current.push(setTimeout(fn, ms))

      if (reduced) {
        // No typing, no staged reveal — the finished exchange, immediately.
        setTyped(scene.prompt)
        setPhase(PHASES.ANSWERED)
        setRevealed(scene.requirements.length)
        return
      }

      setTyped('')
      setRevealed(0)
      setPhase(PHASES.TYPING)

      const chars = [...scene.prompt]
      chars.forEach((_, i) => {
        after(60 + i * 21, () => setTyped(chars.slice(0, i + 1).join('')))
      })

      const typedDone = 60 + chars.length * 21
      after(typedDone + 200, () => setPhase(PHASES.THINKING))
      after(typedDone + 1050, () => setPhase(PHASES.ANSWERED))
      scene.requirements.forEach((_, i) => {
        after(typedDone + 1250 + i * 190, () => setRevealed(i + 1))
      })
    },
    [clearTimers, reduced],
  )

  // Starts only once the section is actually on screen, so the exchange is
  // never already over by the time the visitor scrolls to it.
  useEffect(() => {
    if (!inView) return undefined
    run(SCENARIOS[index])
    return clearTimers
  }, [inView, index, run, clearTimers])

  return (
    <section className="lp-demo" id="demo" ref={ref} aria-labelledby="demo-heading">
      <div className="lp-shell">
        <p className="lp-eyebrow">جرّبه</p>
        <h2 id="demo-heading" className="lp-h2">
          ما تحتاج تتعلّم كيف تستخدمه.
          <span className="lp-h2-dim"> بس تكلّم.</span>
        </h2>

        <div className="lp-demo-grid">
          <div className="lp-demo-pick">
            <p className="lp-label">جرّب وحدة من هذي:</p>
            <div className="lp-demo-chips" role="group" aria-label="أمثلة للتجربة">
              {SCENARIOS.map((scene, i) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`lp-chip${i === index ? ' is-active' : ''}`}
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                >
                  {scene.prompt}
                </button>
              ))}
            </div>
            <p className="lp-demo-note">
              هذي إعادة عرض لجلسة حقيقية، بنفس الشكل اللي يطلّعه أريب فعليًا — مو نموذج شغّال الحين على
              هذي الصفحة.
            </p>
          </div>

          <div className="lp-demo-stage">
            <div className="lp-chat" aria-live="polite">
              <div className="lp-msg lp-msg-user">
                <span className="lp-msg-who">أنت</span>
                <p className="lp-msg-body">
                  {typed}
                  {phase === PHASES.TYPING && <span className="lp-caret" aria-hidden="true" />}
                </p>
              </div>

              {phase === PHASES.THINKING && (
                <div className="lp-msg lp-msg-ai">
                  <span className="lp-msg-who">أريب</span>
                  <p className="lp-thinking" aria-label="أريب يحلل">
                    <span /> <span /> <span />
                  </p>
                </div>
              )}

              {phase === PHASES.ANSWERED && (
                <div className="lp-msg lp-msg-ai is-in">
                  <span className="lp-msg-who">أريب</span>
                  <p className="lp-msg-body">{scenario.reply}</p>
                </div>
              )}
            </div>

            <aside className={`lp-extract${phase === PHASES.ANSWERED ? ' is-live' : ''}`} aria-label="ما استخرجه أريب">
              <header className="lp-extract-head">
                <span className="lp-label">طلع من هذي الرسالة</span>
                <span className="lp-conf">
                  <span className="lp-conf-bar">
                    <span
                      className="lp-conf-fill"
                      style={{ '--v': phase === PHASES.ANSWERED ? `${scenario.confidence}%` : '0%' }}
                    />
                  </span>
                  <span className="lp-num">{phase === PHASES.ANSWERED ? scenario.confidence : 0}٪</span>
                </span>
              </header>

              <ul className="lp-req-list">
                {scenario.requirements.map((req, i) => (
                  <li key={req.id} className={`lp-req${i < revealed ? ' is-in' : ''}`}>
                    <span className="lp-req-id lp-num">{req.id}</span>
                    <span className="lp-req-title">{req.title}</span>
                    <span className="lp-req-meta">
                      {req.type} · {req.priority}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="lp-missing">
                <span className="lp-label">ولسه ناقص</span>
                <ul>
                  {scenario.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}
