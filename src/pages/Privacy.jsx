import { Link } from 'react-router-dom'
import { PublicPage } from '../components/PublicPage'
import { CONTACT_EMAIL } from '../lib/site'

/* ============================================================
   Privacy policy.

   Every statement here was checked against the code before it was
   written — the third parties named are exactly the ones the app calls
   (Supabase in src/lib/supabase.js, Google Gemini in
   server/providers/GeminiProvider.js, Groq in GroqProvider.js), and the
   storage claims match how Supabase's client actually persists a session.
   Nothing describes a practice the product does not have: there is no
   payment processor, no ad network, no cross-site tracking, and the page
   says so rather than reserving rights the app never exercises.
   ============================================================ */

const UPDATED = '28 أغسطس 2026'

export function Privacy() {
  return (
    <PublicPage
      title="سياسة الخصوصية"
      description="ما الذي يجمعه أريب من بيانات، أين يُخزَّن، ومن يعالجه — بما في ذلك إرسال محتوى المحادثة إلى نماذج الذكاء الاصطناعي لتوليد وثيقة المتطلبات."
    >
      <article className="legal">
        <header className="legal-head">
          <h1>سياسة الخصوصية</h1>
          <p className="text-muted legal-updated">
            آخر تحديث: <span className="ltr-nums">{UPDATED}</span>
          </p>
          <p className="text-secondary">
            هذه السياسة تشرح ما يجمعه أريب فعليًا، ولماذا، ومع من يُشارَك. كُتبت لتصف سلوك المنتج كما هو
            اليوم — لا صلاحيات محجوزة لاستخدامات غير قائمة.
          </p>
        </header>

        <section>
          <h2>١. البيانات التي نجمعها</h2>

          <h3>بيانات الحساب</h3>
          <p>
            عند التسجيل نجمع <strong>بريدك الإلكتروني</strong> و<strong>كلمة المرور</strong>. كلمة المرور لا
            تصلنا ولا تُخزَّن لدينا كنص؛ تتولّى Supabase Auth تخزينها مُجزّأة (hashed). عند إنشاء الحساب
            تُنشأ لك مساحة عمل تلقائيًا، ويُشتق اسمها من الجزء الذي يسبق علامة @ في بريدك.
          </p>

          <h3>بيانات مشاريعك وعملائك</h3>
          <p>
            أسماء العملاء الذين تضيفهم، وأسماء المشاريع وأنواعها وأوصافها. هذه بيانات تُدخِلها أنت عن عملك،
            وقد تخصّ أطرافًا ثالثة (عملاءك) — أنت المسؤول عن أن يكون لديك الحق في إدخالها.
          </p>

          <h3>محتوى المحادثة والمتطلبات</h3>
          <p>
            كل رسالة تكتبها في جلسة الاكتشاف تُحفظ مرتبطة بالمشروع، وكذلك المتطلبات المستخرجة منها ووثيقة
            الـ PRD المُولَّدة. هذا هو جوهر المنتج: بدون حفظ المحادثة لا يمكن استئنافها ولا توليد الوثيقة.
          </p>

          <h3>ما لا نجمعه</h3>
          <ul>
            <li>لا نطلب بيانات بطاقات دفع — لا توجد مدفوعات في المنتج حاليًا.</li>
            <li>لا نجمع موقعك الجغرافي، ولا نبني ملفًا إعلانيًا عنك.</li>
            <li>لا نشتري بيانات عنك من أي جهة، ولا نبيع بياناتك لأي جهة.</li>
          </ul>
        </section>

        <section>
          <h2>٢. كيف نستخدم هذه البيانات</h2>
          <ul>
            <li>لتشغيل حسابك ومصادقة دخولك.</li>
            <li>لإدارة جلسة الاكتشاف: فهم ما تكتبه، طرح الأسئلة الناقصة، واستخراج المتطلبات.</li>
            <li>لتوليد وثيقة الـ PRD وتصديرها بصيغة PDF أو Markdown.</li>
            <li>لعرض مشاريعك السابقة وحالتها عند عودتك.</li>
          </ul>
          <p>
            لا نستخدم محتوى مشاريعك لتدريب أي نموذج ذكاء اصطناعي يخصّنا، ولا نطّلع عليه إلا عند الضرورة
            التقنية لحل عطل تُبلغ عنه.
          </p>
        </section>

        <section>
          {/* The single most important disclosure in this document: users are
              sending their clients' commercial requirements to two external
              model providers. Burying that would be the dishonest choice. */}
          <h2>٣. الأطراف الثالثة التي تعالج بياناتك</h2>
          <p>
            أريب لا يعمل بمعزل. لكي يؤدي وظيفته، تمرّ بياناتك عبر الخدمات التالية — ولكلٍّ منها سياسة خصوصية
            خاصة به تسري على ما يستلمه:
          </p>

          <div className="legal-table-wrap">
            <table className="legal-table">
              <thead>
                <tr>
                  <th scope="col">الخدمة</th>
                  <th scope="col">ما يصلها</th>
                  <th scope="col">لماذا</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Supabase</th>
                  <td>حسابك، مشاريعك، عملاؤك، رسائلك، متطلباتك، ووثائقك</td>
                  <td>الاستضافة وقاعدة البيانات والمصادقة</td>
                </tr>
                <tr>
                  <th scope="row">Google (Gemini API)</th>
                  <td>محتوى رسائل جلسة الاكتشاف</td>
                  <td>فهم كلامك، طرح الأسئلة، واستخراج المتطلبات</td>
                </tr>
                <tr>
                  <th scope="row">Groq</th>
                  <td>المتطلبات المستخرجة وبيانات المشروع</td>
                  <td>صياغة وثيقة الـ PRD</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="legal-callout">
            <strong>انتبه:</strong> إذا كانت معلومات عميلك سرّية أو خاضعة لاتفاقية عدم إفصاح، فإن إدخالها في
            جلسة الاكتشاف يعني إرسالها إلى مزوّدي النماذج أعلاه. تأكّد أن هذا مسموح لك قبل إدخالها.
          </p>
        </section>

        <section>
          <h2>٤. الكوكيز والتخزين المحلي</h2>
          <p>
            <strong>أريب لا يستخدم كوكيز تتبّع، ولا كوكيز إعلانية، ولا أي أداة تتبّع عابرة للمواقع.</strong>{' '}
            لهذا لن ترى في الموقع نافذة موافقة على الكوكيز: لا يوجد ما نطلب الموافقة عليه.
          </p>
          <p>ما يُخزَّن في متصفحك يقتصر على:</p>
          <ul>
            <li>
              <strong>رمز الجلسة</strong> — تحفظه مكتبة Supabase في التخزين المحلي (localStorage) لإبقائك
              مسجّل الدخول. حذفه يعني تسجيل خروجك، وهو ضروري لعمل الموقع.
            </li>
          </ul>
          <p>
            الخطوط العربية مستضافة على خوادمنا نفسها ولا تُحمَّل من شبكة خارجية، فلا يُرسل عنوان IP الخاص بك
            إلى أي طرف ثالث بمجرد فتح الصفحة.
          </p>
        </section>

        <section>
          <h2>٥. الاحتفاظ بالبيانات وحذفها</h2>
          <p>
            نحتفظ ببيانات مشاريعك ما دام حسابك قائمًا. حذف المشروع من داخل التطبيق يحذف معه رسائله ومتطلباته
            ووثيقته. عند حذف الحساب تُحذف مساحة العمل وكل ما يتبعها.
          </p>
          <p>
            ما أُرسل سابقًا إلى مزوّدي النماذج (Google وGroq) يخضع لسياسات الاحتفاظ الخاصة بهم، ولا نستطيع
            حذفه نيابةً عنك.
          </p>
        </section>

        <section>
          <h2>٦. الأمان</h2>
          <p>
            العزل بين مساحات العمل مفروض على مستوى قاعدة البيانات عبر سياسات <span dir="ltr">Row Level Security</span>،
            لا على مستوى الواجهة فقط — أي أن حسابًا لا يستطيع قراءة بيانات مساحة عمل أخرى حتى لو تلاعب
            بالطلبات. الاتصال بالموقع مشفّر عبر HTTPS.
          </p>
          <p>
            لا يوجد نظام كامل الحصانة، ولا ندّعي ذلك. إن اكتشفت ثغرة، أبلغنا قبل نشرها.
          </p>
        </section>

        <section>
          <h2>٧. حقوقك</h2>
          <ul>
            <li>الاطلاع على بياناتك وتصحيحها — من داخل التطبيق مباشرة.</li>
            <li>تصدير وثائقك بصيغة PDF أو Markdown في أي وقت.</li>
            <li>حذف مشاريعك أو حسابك بالكامل.</li>
            <li>الاعتراض على معالجة معيّنة أو طلب نسخة من بياناتك — عبر التواصل معنا.</li>
          </ul>
        </section>

        <section>
          <h2>٨. التواصل</h2>
          <p>
            لأي سؤال عن هذه السياسة أو طلب متعلق ببياناتك،{' '}
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

        <section>
          <h2>٩. تغييرات على هذه السياسة</h2>
          <p>
            إن تغيّرت طريقة معالجتنا للبيانات — مثل إضافة مزوّد نماذج جديد أو بوابة دفع — سنحدّث هذه الصفحة
            ونغيّر تاريخ آخر تحديث أعلاها. استمرارك في استخدام أريب بعد التحديث يعني قبولك للنسخة الجديدة.
          </p>
          <p>
            اطّلع أيضًا على <Link to="/terms">الشروط والأحكام</Link>.
          </p>
        </section>
      </article>
    </PublicPage>
  )
}
