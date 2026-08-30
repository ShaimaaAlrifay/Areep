import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from '../hooks/useReducedMotion'

/* ============================================================
   FAQ accordion.

   Built on native <details>/<summary> rather than a div-and-ARIA
   reimplementation. The native element already gives keyboard operation
   (Enter/Space), correct expanded/collapsed announcement to screen
   readers, and — importantly for a page we want indexed — content that
   is present in the DOM and findable by in-page search even while
   collapsed. Adding role="button" or aria-expanded on top of it would
   fight the browser, not help it.

   The questions are the ones this product actually raises: how it
   differs from a generic chatbot, what happens to a client's
   confidential material, and whether the output can be trusted. Generic
   filler ("Is it easy to use?") is deliberately absent.
   ============================================================ */

export const FAQ_ITEMS = [
  {
    q: 'وش الفرق بين أريب وأي مساعد ذكاء اصطناعي عام؟',
    a: (
      <>
        <p>
          المساعد العام يعطيك جواب. أريب يمشي معك في <strong>عملية</strong> كاملة: يسألك عن اللي فاتك،
          وينتبه إذا كلام عميلك في أول الجلسة ما ركب على كلامه في آخرها، ويحوّل اللي انقال إلى متطلبات
          مرقّمة ومرتّبة بأولويات MoSCoW — وبعدين يعرضها عليك تراجعها قبل ما يبني الوثيقة.
        </p>
        <p>والمخرَج ملف PDF بقالب ثابت وترقيم وفهرس، مو نص تنسخه وتلصقه وتعيد ترتيبه بنفسك.</p>
      </>
    ),
  },
  {
    q: 'أريب يفهم اللهجات ولا لازم أكتب فصحى؟',
    a: (
      <p>
        الجلسة مصمّمة تمشي بالعربي زي ما يتكلّم عميلك فعلًا، مو بالفصحى الرسمية. تكتب كلامه زي ما سمعته،
        وأريب يطلّع منه المتطلب ويصيغه في الوثيقة بلغة مهنية. المخرَج النهائي عربي مرتّب ومنسّق بالكامل
        مع دعم RTL حقيقي.
      </p>
    ),
  },
  {
    q: 'وش يصير ببيانات عميلي؟ تروح لجهات خارجية؟',
    a: (
      <>
        <p>
          نعم، ولازم تعرفها قبل ما تبدأ: محتوى المحادثة يروح لمزوّدي نماذج ذكاء اصطناعي خارجيين
          (Google وGroq) عشان يعالجونه، ومشاريعك تُخزَّن عند Supabase.
        </p>
        <p>
          ما نستخدم محتواك لتدريب نماذجنا، ولا نبيعه، وما فيه بالموقع أي أداة تتبّع. وإذا كانت معلومات
          عميلك تحت اتفاقية عدم إفصاح، تأكّد إن هذا الاستخدام مسموح لك. التفاصيل كاملة في{' '}
          <Link to="/privacy">سياسة الخصوصية</Link>.
        </p>
      </>
    ),
  },
  {
    q: 'أقدر أعدّل المتطلبات قبل ما تطلع الوثيقة؟',
    a: (
      <p>
        نعم، وهي خطوة أساسية مو اختيارية. بعد الجلسة تفتح لك شاشة مراجعة المتطلبات، تعدّل أي متطلب أو
        تحذفه أو تضيف واحد فات أريب، وتضبط أولويته. والوثيقة تتبنى من اللي اعتمدته أنت.
      </p>
    ),
  },
  {
    q: 'الوثيقة جاهزة أسلّمها للعميل على طول؟',
    a: (
      <p>
        اعتبرها <strong>مسوّدة متقدّمة، مو نسخة نهائية</strong>. النماذج اللغوية تغلط: ممكن تستنتج متطلب
        ما انقال، أو تكتب افتراض بثقة زايدة. أريب يختصر عليك ساعات صياغة وتنسيق، بس المراجعة المهنية
        الأخيرة تبقى مسؤوليتك — وعشان كذا حطّينا شاشة المراجعة قبل التوليد.
      </p>
    ),
  },
  {
    q: 'أقدر أصدّر الوثيقة بأي صيغة؟',
    a: (
      <p>
        <strong>PDF</strong> بقالب أريب — نص عربي حقيقي تقدر تحدّده وتبحث داخله، مو صورة — و
        <strong> Markdown</strong> إذا بغيت تنقل المحتوى إلى Notion أو Confluence أو مستودع الكود.
      </p>
    ),
  },
  {
    q: 'لازم عندي خبرة بكتابة وثائق المتطلبات؟',
    a: (
      <p>
        لا. أريب هو اللي يقود الجلسة بالأسئلة، وعارف وش المفروض تحتويه الوثيقة (الملخص التنفيذي، تحليل
        المشكلة، الأهداف ومؤشرات النجاح، المتطلبات الوظيفية، قصص المستخدم، النطاق، الافتراضات). دورك إنك
        تنقل كلام العميل وتراجع النتيجة.
      </p>
    ),
  },
  {
    q: 'أريب مجاني؟',
    a: (
      <p>
        نعم، مجاني حاليًا وما فيه خطط مدفوعة. وإذا تغيّر هذا بعدين، بنخبر المستخدمين قبل التغيير، وما
        بنفاجئك بإنك تفقد وصولك لوثائق أنت سوّيتها.
      </p>
    ),
  },
]

/* How long Areeb "thinks" before the answer appears. Long enough to read
   as a reply rather than an instant lookup, short enough that nobody is
   waiting on it — the beat is the point, not the delay.

   Deliberately just past the 320ms height transition: the answer starts
   fading in as the panel finishes opening, so there is no stretch of
   full-height empty box with three dots stranded at the top of it. */
const THINKING_MS = 340

/* ============================================================
   One question, asked and answered.

   The accordion is framed as an exchange: the question is the visitor's
   message, and opening it is Areeb replying — same labels, same rules on
   the reading-leading edge, same thinking dots as the real chat in the
   product. It is the same interaction as before, wearing the interface
   the rest of the app already speaks in.

   The answer is in the DOM from the first render and stays there while
   the dots are showing — it is only transparent. That matters three
   times over: the height animation has something to measure, so it runs
   once instead of twice; find-in-page still reaches the text; and a
   screen reader announces the answer immediately rather than being made
   to sit through a decorative pause.

   The <details> element is kept — it is what gives keyboard operation,
   the expanded/collapsed announcement, and find-in-page reaching text
   inside a closed item. What is NOT kept is letting the browser toggle
   it, because a native toggle is instantaneous by definition: the
   content simply starts or stops being rendered.

   An earlier attempt animated `::details-content` instead, which is the
   tidier CSS and needs no JavaScript at all — but it only exists in
   recent Chromium. In Safari and Firefox the rule is ignored and the
   panel snapped open exactly as before, which is a fix that works on the
   machine it was written on and nowhere else.

   So: the click is intercepted, `open` is set by us, and a wrapper's
   height is animated between 0 and its measured content height. Closing
   holds `open` true until the animation finishes, so the content is
   still there to animate. Height settles to `auto` once open, so a
   panel whose content reflows (a long answer wrapping at a narrower
   width) is not stuck at a stale pixel height.
   ============================================================ */
function FaqItem({ item }) {
  const [open, setOpen] = useState(false)
  const [thinking, setThinking] = useState(false)
  const wrapRef = useRef(null)
  const closingRef = useRef(false)
  const timerRef = useRef(0)
  const reduced = useReducedMotion()

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleClick = (event) => {
    // The browser would toggle `open` itself on this click; we do it.
    event.preventDefault()
    clearTimeout(timerRef.current)

    const wrap = wrapRef.current

    if (reduced || !wrap) {
      // No animation to run, so nothing should be holding an inline height,
      // and no pause before the answer.
      if (wrap) wrap.style.height = ''
      setThinking(false)
      setOpen((value) => !value)
      return
    }

    if (!open) {
      closingRef.current = false
      setThinking(true)
      setOpen(true)
      timerRef.current = setTimeout(() => setThinking(false), THINKING_MS)
      // Two frames: one for React to render the content so it can be
      // measured, one so the browser registers the 0 height as a start
      // value rather than collapsing both into a single style change.
      requestAnimationFrame(() => {
        wrap.style.height = '0px'
        requestAnimationFrame(() => {
          wrap.style.height = `${wrap.scrollHeight}px`
        })
      })
    } else {
      closingRef.current = true
      setThinking(false)
      wrap.style.height = `${wrap.scrollHeight}px`
      requestAnimationFrame(() => {
        wrap.style.height = '0px'
      })
    }
  }

  const handleTransitionEnd = (event) => {
    if (event.propertyName !== 'height' || event.target !== wrapRef.current) return
    if (closingRef.current) {
      closingRef.current = false
      // Only the state change here. Clearing the inline height as well
      // would restore the panel to its natural size for the frame between
      // this line and React committing `open={false}` — a flash of the
      // full answer at the very end of closing it. The stale `0px` is
      // harmless: opening always sets the height explicitly again.
      setOpen(false)
    } else if (wrapRef.current) {
      wrapRef.current.style.height = 'auto'
    }
  }

  return (
    <details className="faq-item" open={open}>
      <summary className="faq-question" onClick={handleClick}>
        <span className="faq-ask">
          <span className="faq-who">أنت</span>
          <span className="faq-ask-text">{item.q}</span>
        </span>
        <ChevronIcon />
      </summary>
      <div className="faq-answer-wrap" ref={wrapRef} onTransitionEnd={handleTransitionEnd}>
        <div className="faq-reply">
          <span className="faq-who faq-who-ai">أريب</span>
          <div className="faq-reply-body">
            {thinking && (
              <span className="faq-typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
            <div className={`faq-answer${thinking ? ' is-pending' : ''}`}>{item.a}</div>
          </div>
        </div>
      </div>
    </details>
  )
}

/** The accordion itself — shared between the landing section and /faq. */
export function FaqList({ items = FAQ_ITEMS }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <FaqItem key={item.q} item={item} />
      ))}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg className="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
