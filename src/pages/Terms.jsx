import { Link } from 'react-router-dom'
import { PublicPage } from '../components/PublicPage'
import { CONTACT_EMAIL } from '../lib/site'

/* ============================================================
   Terms of service.

   Scoped to what the product actually is today: a free, no-payment,
   AI-assisted requirements tool with no SLA. It deliberately does not
   contain the usual boilerplate about subscriptions, refunds, or tiers —
   none of that exists in the code, and terms describing a product that
   isn't shipped are both misleading and unenforceable.

   The AI-accuracy and client-data clauses are the two that matter most
   here, because they cover the two ways this product can actually cause
   a user harm: a wrong PRD acted on as fact, and confidential client
   material sent to a model provider.
   ============================================================ */

const UPDATED = '28 أغسطس 2026'

export function Terms() {
  return (
    <PublicPage
      title="الشروط والأحكام"
      description="شروط استخدام أريب: ما يقدّمه المنتج، مسؤوليتك عن بيانات عملائك، وحدود الاعتماد على المخرجات المُولَّدة بالذكاء الاصطناعي."
    >
      <article className="legal">
        <header className="legal-head">
          <h1>الشروط والأحكام</h1>
          <p className="text-muted legal-updated">
            آخر تحديث: <span className="ltr-nums">{UPDATED}</span>
          </p>
          <p className="text-secondary">
            باستخدامك أريب فأنت توافق على ما يلي. إن لم توافق، فلا تستخدم الخدمة.
          </p>
        </header>

        <section>
          <h2>١. ما هي الخدمة</h2>
          <p>
            أريب أداة تساعدك على إدارة جلسة اكتشاف متطلبات مع عميلك، واستخراج المتطلبات من المحادثة، وتوليد
            وثيقة متطلبات منتج (PRD) قابلة للتصدير. الخدمة مقدَّمة كما هي، وهي حاليًا مجانية وبلا خطط مدفوعة
            ولا التزام بمستوى خدمة (SLA).
          </p>
        </section>

        <section>
          <h2>٢. حسابك</h2>
          <ul>
            <li>تحتاج بريدًا إلكترونيًا صحيحًا لإنشاء حساب، وأنت مسؤول عن سرّية كلمة مرورك.</li>
            <li>أنت مسؤول عن كل نشاط يجري عبر حسابك.</li>
            <li>لا تُنشئ حسابًا نيابةً عن شخص آخر دون إذنه.</li>
          </ul>
        </section>

        <section>
          <h2>٣. بيانات عملائك — مسؤوليتك</h2>
          <p>
            المحتوى الذي تُدخله غالبًا ما يخصّ طرفًا ثالثًا: عميلك. أنت تُقرّ بأن لديك الحق في إدخال هذه
            المعلومات ومعالجتها عبر أريب، وبأنك اطّلعت على{' '}
            <Link to="/privacy">سياسة الخصوصية</Link> وتفهم أن محتوى المحادثة يُرسل إلى مزوّدي نماذج ذكاء
            اصطناعي خارجيين لمعالجته.
          </p>
          <p>
            إن كانت معلومات عميلك خاضعة لاتفاقية عدم إفصاح أو تصنيف سرّية، فالتحقق من أن هذا الاستخدام
            مسموح مسؤوليتك أنت.
          </p>
        </section>

        <section>
          <h2>٤. المخرجات المُولَّدة بالذكاء الاصطناعي</h2>
          <p>
            أريب يستخدم نماذج لغوية. هذه النماذج <strong>تُخطئ</strong>: قد تستنتج متطلبًا لم يُقَل، أو تفوّت
            متطلبًا قيل، أو تصوغ افتراضًا بثقة زائدة.
          </p>
          <p>
            الوثيقة المُولَّدة <strong>مسوّدة تحتاج مراجعتك</strong>، وليست بديلًا عن حكمك المهني ولا عن
            موافقة عميلك. لهذا السبب تحديدًا يضع أريب شاشة مراجعة للمتطلبات قبل التوليد. لا نتحمّل مسؤولية
            أي قرار تجاري أو تعاقدي تتخذه اعتمادًا على مخرجات لم تراجعها.
          </p>
        </section>

        <section>
          <h2>٥. الاستخدام المقبول</h2>
          <p>يُمنع استخدام أريب في:</p>
          <ul>
            <li>أي نشاط مخالف للقانون المعمول به في بلدك.</li>
            <li>إدخال بيانات حصلت عليها دون وجه حق.</li>
            <li>محاولة اختراق الخدمة أو تجاوز حدودها التقنية أو الوصول إلى بيانات مستخدمين آخرين.</li>
            <li>إساءة استخدام الخدمة بما يعطّلها عن الآخرين (مثل الطلبات الآلية المكثّفة).</li>
          </ul>
          <p>يحق لنا تعليق أي حساب يخالف ما سبق.</p>
        </section>

        <section>
          <h2>٦. الملكية الفكرية</h2>
          <p>
            <strong>محتواك يبقى ملكك.</strong> المتطلبات التي تُدخلها والوثائق التي تُولّدها ملكٌ لك ولعميلك،
            ولا ندّعي أي حق فيها. في المقابل، اسم أريب وهويته البصرية وواجهته وقالب الوثيقة ملكٌ لنا.
          </p>
        </section>

        <section>
          <h2>٧. حدود المسؤولية</h2>
          <p>
            الخدمة مقدَّمة «كما هي» ودون ضمانات من أي نوع. لا نضمن استمرارية التوفّر ولا خلوّ الخدمة من
            الأعطال، ولا نتحمّل مسؤولية أي خسارة غير مباشرة أو تبعية ناتجة عن استخدامها — بما في ذلك فقدان
            بيانات أو أرباح.
          </p>
          <p>احتفظ دائمًا بنسخة من وثائقك المهمة عبر التصدير.</p>
        </section>

        <section>
          <h2>٨. تعديل الشروط أو إيقاف الخدمة</h2>
          <p>
            قد نحدّث هذه الشروط مع تطوّر المنتج، وسيظهر ذلك في تاريخ آخر تحديث أعلاه. إن قررنا إيقاف الخدمة
            فسنسعى لإشعارك مسبقًا بوقت يكفي لتصدير وثائقك.
          </p>
        </section>

        <section>
          <h2>٩. التواصل</h2>
          <p>
            لأي استفسار حول هذه الشروط،{' '}
            {CONTACT_EMAIL ? (
              <>
                راسلنا على{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="legal-mail">
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            ) : (
              'تواصل مع مالك مساحة العمل التي دُعيت إليها.'
            )}
          </p>
        </section>
      </article>
    </PublicPage>
  )
}
