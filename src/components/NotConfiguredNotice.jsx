/** Shown wherever a screen needs Supabase but the env vars aren't set yet. */
export function NotConfiguredNotice() {
  return (
    <div className="notice" role="status">
      <p className="notice-title">قاعدة البيانات غير مهيأة بعد</p>
      <p className="text-secondary">
        لم يتم ضبط بيانات الاتصال بـ Supabase بعد. أضف <code>VITE_SUPABASE_URL</code> و
        <code> VITE_SUPABASE_ANON_KEY</code> في ملف <code>.env</code> (انظر <code>.env.example</code>) ثم
        أعد تشغيل التطبيق.
      </p>
    </div>
  )
}
