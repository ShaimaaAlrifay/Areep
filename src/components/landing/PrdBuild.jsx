import { useEffect, useState } from 'react'
import { useInView } from '../../hooks/useInView'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/* ============================================================
   The document, assembling.

   The PRD is the thing the product actually hands over, so it gets a
   section rather than a screenshot. The page shape mirrors the real
   template in src/templates/areep/prdPdf.jsx exactly — cover plus seven
   numbered sections, in the same order, with the same Arabic titles — so
   what a visitor sees here is what lands in their download.

   It builds line by line on scroll-in, because "أريب يبني الوثيقة" is a
   claim better shown than written.
   ============================================================ */

const PAGES = [
  { n: '01', title: 'الملخص التنفيذي', lines: ['المشكلة', 'الفرصة', 'الحل', 'النتيجة', 'أبرز الرؤى'] },
  { n: '02', title: 'تحليل المشكلة', lines: ['الوضع الحالي', 'نقاط الاحتكاك', 'السبب الجذري', 'الوضع المنشود'] },
  { n: '03', title: 'الأهداف ومؤشرات النجاح', lines: ['GOAL-001 · تقليل زمن التجهيز', 'GOAL-002 · وضوح العدد'] },
  { n: '04', title: 'المتطلبات الوظيفية', lines: ['FR-001 · إلزامي', 'FR-002 · إلزامي', 'NFR-001 · مفضّل'] },
  { n: '05', title: 'قصص المستخدم', lines: ['بصفتي… أبغى… عشان…', 'معايير القبول'] },
  { n: '06', title: 'نطاق العمل', lines: ['ضمن النطاق', 'خارج النطاق'] },
  { n: '07', title: 'الافتراضات والأسئلة المفتوحة', lines: ['الافتراضات', 'الأسئلة المفتوحة', 'سجل الإصدارات'] },
]

/* Each title and each line gets a fixed position in the build order,
   computed once at module scope. Deriving it with a counter mutated while
   rendering worked, but a value that survives past the render it belongs
   to is exactly the kind of thing that breaks under a re-render — and the
   order is static data, so it belongs out here. */
const ORDERED = (() => {
  let step = 0
  return PAGES.map((page) => ({
    ...page,
    at: step++,
    lines: page.lines.map((text) => ({ text, at: step++ })),
  }))
})()

const TOTAL = ORDERED.reduce((sum, p) => sum + p.lines.length + 1, 0)

export function PrdBuild() {
  const reduced = useReducedMotion()
  const [ref, inView] = useInView({ threshold: 0.25 })
  const [built, setBuilt] = useState(0)

  useEffect(() => {
    if (!inView) return undefined
    if (reduced) {
      setBuilt(TOTAL)
      return undefined
    }
    let step = 0
    const timer = setInterval(() => {
      step += 1
      setBuilt(step)
      if (step >= TOTAL) clearInterval(timer)
    }, 105)
    return () => clearInterval(timer)
  }, [inView, reduced])

  return (
    <section className="lp-prd" id="prd" ref={ref} aria-labelledby="prd-heading">
      <div className="lp-shell lp-prd-grid">
        <div className="lp-prd-copy">
          <p className="lp-eyebrow">المخرَج</p>
          <h2 id="prd-heading" className="lp-h2">
            وثيقة تُسلَّم،
            <span className="lp-h2-dim"> لا ملخّص يُنسخ.</span>
          </h2>
          <p className="lp-lede">
            مو مجرد كلام مرتّب وخلاص. أريب ياخذ اللي طلع من الجلسة ويحوّله إلى PRD تقدر تراجعه وتعدّله
            وتسلّمه لفريقك. ثمان صفحات بقالب أريب، بنص عربي حقيقي تقدر تحدّده وتبحث داخله — مو صورة داخل
            الملف.
          </p>
          <ul className="lp-prd-facts">
            <li>
              <span className="lp-num">8</span> صفحات، RTL من أساس التصميم مو محاذاة وخلاص
            </li>
            <li>
              <span className="lp-num">7</span> أنواع متطلبات، كل واحد له معرّف ثابت
            </li>
            <li>
              <span className="lp-num">PDF · MD</span> من نفس المصدر، بدون ما يعيد التوليد
            </li>
          </ul>
        </div>

        <div className="lp-doc" aria-hidden="true">
          <div className="lp-doc-sheet">
            <div className="lp-doc-head">
              <span className="lp-doc-mark">أريب</span>
              <span className="lp-num lp-doc-meta">PRD · v1.0</span>
            </div>
            {ORDERED.map((page) => (
              <div key={page.n} className="lp-doc-block">
                <p className={`lp-doc-title${built > page.at ? ' is-in' : ''}`}>
                  <span className="lp-num">{page.n}</span> {page.title}
                </p>
                {page.lines.map((line) => (
                  <span key={line.text} className={`lp-doc-line${built > line.at ? ' is-in' : ''}`}>
                    {line.text}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <span className={`lp-doc-cursor${built >= TOTAL ? ' is-done' : ''}`} />
        </div>
      </div>
    </section>
  )
}
