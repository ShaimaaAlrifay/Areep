import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useScrollProgress } from '../../hooks/useInView'

/* ============================================================
   The five acts: فوضى → فهم → تحليل → بناء → نتيجة.

   One pinned stage, five states, driven by how far the visitor has
   scrolled through the section — so the story is told *by* scrolling
   rather than beside it. The same ~40 fragments persist across all five
   acts and are only re-arranged; nothing is added or removed. That is the
   point being made: the product does not invent material, it organises
   what you already said.

   The stage is a grid of positioned fragments rather than a canvas,
   because these carry real text (requirement ids, section names) that
   should be selectable and legible to a screen reader — and because at
   ~40 elements the DOM is cheaper than a second rAF loop next to the
   hero's.

   Under `prefers-reduced-motion` the pin is dropped entirely: the section
   becomes five ordinary stacked blocks, which is the honest static form
   of the same narrative.
   ============================================================ */

const ACTS = [
  {
    n: '01',
    kicker: 'الفوضى',
    title: 'غالبًا تبدأ كذا.',
    body: 'رسالة واتساب هنا، ملاحظة هناك، وكلام من اجتماع ما أحد كتبه. وبعدها بأسبوع يجي طلب تغيير جديد. وكل واحد عنده جزء من الصورة.',
  },
  {
    n: '02',
    kicker: 'الفهم',
    title: 'أريب يسأل قبل لا يفترض.',
    body: 'ما يستعجل يعطيك حل. يسألك عن المشكلة، مين المستخدم، وكيف تصير المشكلة اليوم. سؤالين مهمين أحسن من عشر افتراضات.',
  },
  {
    n: '03',
    kicker: 'التحليل',
    title: 'الكلام يبدأ ياخذ شكل.',
    body: 'كل اللي قلته يبدأ يتحوّل لأهداف، مستخدمين، ميزات، متطلبات ومخاطر. وكل شيء له معرّف وأولوية، عشان ما تضيع التفاصيل.',
  },
  {
    n: '04',
    kicker: 'البناء',
    title: 'وهنا تبدأ الوثيقة تتكوّن.',
    body: 'ملخص، مشكلة، أهداف، متطلبات، قصص مستخدم ونطاق العمل. كل شيء مرتّب بالطريقة اللي يحتاجها الشخص اللي بيبني المنتج.',
  },
  {
    n: '05',
    kicker: 'النتيجة',
    title: 'شيء تقدر تبدأ منه.',
    body: 'PRD عربي مرتّب بقالب أريب، تقدر تراجعه وتعدّله وتطلّعه PDF أو Markdown. مو مجرد ملخّص طويل للمحادثة.',
  },
]

/* The fragments that survive all five acts. `seat` is the column the
   fragment settles into once the material is organised (act 3 onward). */
const FRAGMENTS = [
  { t: 'يبغى يطلبون أونلاين', seat: 0 },
  { t: 'الطلبات تضيع بالواتساب', seat: 0 },
  { t: 'ما فيه أحد يرد بالليل', seat: 0 },
  { t: 'الزبون يسأل عن السعر', seat: 1 },
  { t: 'توصيل داخل المدينة', seat: 1 },
  { t: 'أبغى أعرف كم طلب', seat: 1 },
  { t: 'الدفع عند الاستلام', seat: 2 },
  { t: 'صور المنتجات قديمة', seat: 2 },
  { t: 'ما عندي مخزون دقيق', seat: 2 },
  { t: 'أهم شي يكون سريع', seat: 3 },
  { t: 'الجوال أهم من اللابتوب', seat: 3 },
  { t: 'ما أبغى تطبيق، موقع يكفي', seat: 3 },
]

const COLUMNS = ['الأهداف', 'المستخدمون', 'المتطلبات', 'النطاق']

/* Row index WITHIN a fragment's own column. Deriving it from the array
   index instead (floor(i / COLUMNS.length)) put every fragment that shared
   a column on the same row, so three of them stacked on one another once
   the material sorted itself in act 03. */
const SEATED = (() => {
  const used = {}
  return FRAGMENTS.map((f) => {
    const row = used[f.seat] ?? 0
    used[f.seat] = row + 1
    return { ...f, row }
  })
})()

/* Deterministic scatter for act 1 — same composition every load. */
function scatter(i) {
  const a = Math.sin(i * 12.9898) * 43758.5453
  const b = Math.sin(i * 78.233) * 12345.6789
  /* x is an inset from the stage's RIGHT edge (inline-start under RTL) and
     the fragment extends leftward from it, so the range stops well short of
     100% — otherwise the widest fragments seat themselves past the far edge
     and get clipped. */
  return {
    x: 4 + (a - Math.floor(a)) * 48,
    y: 8 + (b - Math.floor(b)) * 76,
    r: ((a - Math.floor(a)) - 0.5) * 16,
  }
}

export function Narrative() {
  const reduced = useReducedMotion()
  const [ref, progress] = useScrollProgress(!reduced)
  const stageRef = useRef(null)

  // 5 acts over the scrollable travel; the last act holds a little longer
  // so the section does not snap straight out of its final state.
  const act = reduced ? -1 : Math.min(ACTS.length - 1, Math.floor(progress * ACTS.length * 0.98))

  useEffect(() => {
    if (stageRef.current) stageRef.current.dataset.act = String(act)
  }, [act])

  if (reduced) {
    return (
      <section className="lp-story lp-story-static" aria-labelledby="story-heading">
        <div className="lp-shell">
          <p className="lp-eyebrow">كيف يشتغل</p>
          <h2 id="story-heading" className="lp-h2">
            من كلام ملخبط إلى شيء واضح تقدر تبني عليه.
          </h2>
          <ol className="lp-acts-static">
            {ACTS.map((a) => (
              <li key={a.n}>
                <span className="lp-num lp-act-n">{a.n}</span>
                <span className="lp-act-kicker">{a.kicker}</span>
                <h3 className="lp-act-title">{a.title}</h3>
                <p className="lp-act-body">{a.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    )
  }

  return (
    <section className="lp-story" ref={ref} aria-labelledby="story-heading">
      <div className="lp-story-pin">
        <div className="lp-shell lp-story-inner">
          <div className="lp-story-copy">
            <p className="lp-eyebrow">كيف يشتغل</p>
            <div className="lp-acts" aria-live="polite">
              {ACTS.map((a, i) => (
                <article key={a.n} className={`lp-act${i === act ? ' is-current' : ''}`} aria-hidden={i !== act}>
                  <span className="lp-num lp-act-n">{a.n}</span>
                  <span className="lp-act-kicker">{a.kicker}</span>
                  <h2 id={i === 0 ? 'story-heading' : undefined} className="lp-act-title">
                    {a.title}
                  </h2>
                  <p className="lp-act-body">{a.body}</p>
                </article>
              ))}
            </div>

            <ol className="lp-progress" aria-hidden="true">
              {ACTS.map((a, i) => (
                <li key={a.n} className={i <= act ? 'is-done' : ''}>
                  <span className="lp-num">{a.n}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="lp-stage" ref={stageRef} data-act="0" aria-hidden="true">
            <div className="lp-stage-cols">
              {COLUMNS.map((c) => (
                <span key={c} className="lp-stage-col">
                  {c}
                </span>
              ))}
            </div>
            {SEATED.map((f, i) => {
              const s = scatter(i)
              return (
                <span
                  key={f.t}
                  className="lp-frag"
                  style={{
                    '--sx': `${s.x}%`,
                    '--sy': `${s.y}%`,
                    '--sr': `${s.r}deg`,
                    '--col': f.seat,
                    '--row': f.row,
                    '--i': i,
                  }}
                >
                  {f.t}
                </span>
              )
            })}
            <div className="lp-stage-doc">
              {['الملخص التنفيذي', 'تحليل المشكلة', 'الأهداف', 'المتطلبات', 'قصص المستخدم', 'نطاق العمل'].map(
                (line, i) => (
                  <span key={line} style={{ '--i': i }}>
                    {line}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
