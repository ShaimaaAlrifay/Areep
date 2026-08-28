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
    q: 'ما الفرق بين أريب واستخدام أي مساعد ذكاء اصطناعي عام؟',
    a: (
      <>
        <p>
          المساعد العام يعطيك نصًا. أريب يدير <strong>عملية</strong>: يسأل عمّا نسيت أن تذكره، يرصد التناقض
          بين ما قاله عميلك في بداية الجلسة ونهايتها، ويحوّل الكلام إلى متطلبات مرقّمة ومصنّفة بأولويات
          MoSCoW — ثم يعرضها عليك للمراجعة قبل أن يبني الوثيقة.
        </p>
        <p>المخرَج ملف PDF بقالب ثابت وترقيم وفهرس، لا نص تنسخه وتلصقه وتعيد تنسيقه بنفسك.</p>
      </>
    ),
  },
  {
    q: 'هل يفهم أريب اللهجات العربية أم الفصحى فقط؟',
    a: (
      <p>
        الجلسة مصمّمة لتُدار بالعربية كما يتكلّم بها عميلك فعلًا، لا بالفصحى الرسمية. تكتب كلام العميل كما
        سمعته، وأريب يستخرج منه المتطلب ويصوغه في الوثيقة بلغة مهنية. المخرَج النهائي عربي فصيح ومنسّق
        بالكامل مع دعم RTL حقيقي.
      </p>
    ),
  },
  {
    q: 'ماذا يحدث لبيانات عميلي؟ هل تُرسل إلى جهات خارجية؟',
    a: (
      <>
        <p>
          نعم، وهذا يجب أن تعرفه قبل أن تبدأ: محتوى المحادثة يُرسل إلى مزوّدي نماذج ذكاء اصطناعي خارجيين
          (Google وGroq) لمعالجته، وتُخزَّن مشاريعك لدى Supabase.
        </p>
        <p>
          لا نستخدم محتواك لتدريب نماذجنا، ولا نبيعه، ولا يوجد في الموقع أي أداة تتبّع. إن كانت معلومات عميلك
          خاضعة لاتفاقية عدم إفصاح فتأكّد أن هذا الاستخدام مسموح لك. التفاصيل الكاملة في{' '}
          <Link to="/privacy">سياسة الخصوصية</Link>.
        </p>
      </>
    ),
  },
  {
    q: 'هل يمكنني تعديل المتطلبات قبل توليد الوثيقة؟',
    a: (
      <p>
        نعم، وهي خطوة أساسية وليست اختيارية. بعد الجلسة تفتح شاشة مراجعة المتطلبات حيث تعدّل أي متطلب، أو
        تحذفه، أو تضيف متطلبًا فات أريب، وتضبط أولويته. الوثيقة تُبنى ممّا اعتمدته أنت.
      </p>
    ),
  },
  {
    q: 'هل الوثيقة جاهزة لتسليمها للعميل مباشرة؟',
    a: (
      <p>
        اعتبرها <strong>مسوّدة متقدّمة، لا نسخة نهائية</strong>. النماذج اللغوية تُخطئ: قد تستنتج متطلبًا لم
        يُقَل أو تصوغ افتراضًا بثقة زائدة. أريب يختصر عليك ساعات الصياغة والتنسيق، لكن المراجعة المهنية
        النهائية تبقى مسؤوليتك — ولهذا وُضعت شاشة المراجعة قبل التوليد.
      </p>
    ),
  },
  {
    q: 'بأي صيغ يمكنني تصدير الوثيقة؟',
    a: (
      <p>
        <strong>PDF</strong> بقالب أريب — نص عربي حقيقي قابل للتحديد والبحث، لا صورة ممسوحة — و
        <strong> Markdown</strong> إن أردت نقل المحتوى إلى Notion أو Confluence أو مستودع الكود.
      </p>
    ),
  },
  {
    q: 'هل أحتاج خبرة سابقة في كتابة وثائق المتطلبات؟',
    a: (
      <p>
        لا. أريب يقود الجلسة بالأسئلة، ويعرف ما الذي يجب أن تحتويه الوثيقة (الملخص التنفيذي، تحليل المشكلة،
        الأهداف ومؤشرات النجاح، المتطلبات الوظيفية، قصص المستخدم، النطاق، الافتراضات). دورك أن تنقل كلام
        العميل وتراجع النتيجة.
      </p>
    ),
  },
  {
    q: 'هل أريب مجاني؟',
    a: (
      <p>
        نعم، الخدمة مجانية حاليًا وبلا خطط مدفوعة. إن تغيّر ذلك مستقبلًا فسنُشعر المستخدمين قبل التغيير، ولن
        نفاجئك بفقدان وصولك إلى وثائق أنشأتها.
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
