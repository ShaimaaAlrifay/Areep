import { Link } from 'react-router-dom'
import { LOGO_LOCKUP_WHITE } from '../lib/brand'

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="page">
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <Link to="/" className="brand" style={{ display: 'inline-block', marginBottom: 'var(--space-8)' }}>
          <img src={LOGO_LOCKUP_WHITE} alt="أريب" className="brand-lockup" />
        </Link>
      </div>
      <main
        id="main"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingBottom: 'var(--space-16)',
        }}
      >
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <div className="stack" style={{ gap: 'var(--space-1)', marginBottom: 'var(--space-6)' }}>
            <h1 style={{ fontSize: 22 }}>{title}</h1>
            {subtitle && <p className="text-secondary">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
