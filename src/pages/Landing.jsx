import { Link } from 'react-router-dom'
import { TopNav } from '../components/TopNav'

export function Landing() {
  return (
    <div className="page">
      <TopNav />
      <main
        className="container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 'var(--space-6)',
          paddingBlock: 'var(--space-16)',
        }}
      >
        <span className="placeholder-badge">أداة ذكاء المتطلبات لمحللي ومدراء المنتج</span>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', maxWidth: '18ch', lineHeight: 1.3 }}>
          من كلام العميل إلى PRD جاهز للتنفيذ.
        </h1>
        <p className="text-secondary" style={{ fontSize: 18, maxWidth: '48ch' }}>
          أريب يساعدك على تنظيم جلسات اكتشاف المتطلبات مع عملائك، وتحويلها إلى مستند متطلبات منظم بخطوات
          واضحة.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register" className="btn btn-primary">
            ابدأ مشروعك
          </Link>
          <Link to="/login" className="btn btn-secondary">
            تسجيل الدخول
          </Link>
        </div>
      </main>
    </div>
  )
}
