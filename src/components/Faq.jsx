import { Link } from 'react-router-dom'

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

/** The accordion itself — shared between the landing section and /faq. */
export function FaqList({ items = FAQ_ITEMS }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.q} className="faq-item">
          <summary className="faq-question">
            <span>{item.q}</span>
            <ChevronIcon />
          </summary>
          <div className="faq-answer">{item.a}</div>
        </details>
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
