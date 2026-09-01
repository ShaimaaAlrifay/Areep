import { useAuthContext } from '../../contexts/AuthContext'
import { Panel, Section } from '../components/Section'

/* ============================================================
   Settings, and the page that documents the console's own honesty rules.

   The tracking table is here because it is the answer to the question
   every empty section raises: "why is this blank?" Written down once, in
   the product, it stops that question from being re-litigated from memory
   every time someone opens the dashboard.
   ============================================================ */

const TRACKING = [
  { area: 'التسجيلات والمشاريع والمتطلبات', status: 'live', note: 'من قاعدة البيانات مباشرة.' },
  { area: 'الوثائق ووقت التوليد', status: 'live', note: 'من عمود prd_generated_at — الوثائق الأقدم منه ما لها طابع زمني.' },
  { area: 'استدعاءات الذكاء الاصطناعي', status: 'live', note: 'من جدول ai_events، يُكتب من دوال الاكتشاف والتوليد.' },
  { area: 'الزوّار ومصادر الزيارات', status: 'missing', note: 'يحتاج مزوّد تحليلات.' },
  { area: 'الإيراد والاشتراكات', status: 'missing', note: 'ما فيه نظام فوترة في المنتج.' },
  { area: 'تقييم المستخدم للوثيقة', status: 'missing', note: 'يحتاج زرّي تقييم في شاشة الوثيقة.' },
  { area: 'إصدارات الوثيقة وإعادة التوليد', status: 'missing', note: 'التوليد الجديد يستبدل السابق.' },
  { area: 'نجاح تصدير PDF', status: 'missing', note: 'التصدير داخل المتصفح بدون إشارة للخادم.' },
]

export function Settings() {
  const { user } = useAuthContext()

  return (
    <Section title="الإعدادات" en="Settings" purpose="من يشوف هذي اللوحة، ووش تتبّعه المنصة فعلًا.">
      <Panel title="الوصول">
        <dl className="ad-defs">
          <div>
            <dt>الحساب</dt>
            <dd>{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt>الصلاحية</dt>
            <dd>مالك (Super Admin)</dd>
          </div>
        </dl>
        <p className="ad-note">
          الصلاحية تُمنح بإضافة صف في جدول <code>app_admins</code>. الجدول محمي بـ RLS بدون أي سياسة، يعني ما
          يُقرأ ولا يُكتب إلا بمفتاح الخدمة من الخادم — ما فيه طريقة يمنح فيها مستخدم نفسه الصلاحية.
        </p>
      </Panel>

      <Panel title="وش نتتبّعه" hint="كل قسم فاضي في اللوحة له سطر هنا يفسّر السبب.">
        <div className="ad-table-scroll">
          <table className="ad-table">
            <thead>
              <tr>
                <th scope="col">المجال</th>
                <th scope="col">الحالة</th>
                <th scope="col">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {TRACKING.map((row) => (
                <tr key={row.area}>
                  <th scope="row">{row.area}</th>
                  <td>
                    <span className={`ad-tag ad-tag-${row.status}`}>{row.status === 'live' ? 'مُتتبَّع' : 'غير مُتتبَّع'}</span>
                  </td>
                  <td className="ad-cell-note">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="قواعد هذي اللوحة">
        <ul className="ad-rules">
          <li>ما فيه رقم مُختلق. المؤشر غير المتوفّر يظهر كـ«غير مُتتبَّع» مع سبب.</li>
          <li>صفر يعني صفر. غياب البيانات شيء ثاني، وله شكل ثاني.</li>
          <li>ما تصل للوحة أي بيانات شخصية — أعداد ونِسب فقط.</li>
          <li>أسباب التنبيهات اجتهاد مبني على حركة الأرقام، مو تشخيص مؤكد.</li>
        </ul>
      </Panel>
    </Section>
  )
}
