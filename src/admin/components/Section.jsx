import { useOutletContext } from 'react-router-dom'
import { ErrorState } from './states'

/** Every section page reads the shell's single snapshot through this. */
export function useAdminData() {
  return useOutletContext()
}

/* Page frame: title, one line of purpose, then the content. The purpose
   line is not decoration — it states what decision the section supports,
   which is what stops a page from drifting into a pile of charts. */
export function Section({ title, en, purpose, children, actions }) {
  return (
    <section className="ad-section">
      <header className="ad-section-head">
        <div>
          <h1>
            {title}
            {en && <span className="ad-section-en">{en}</span>}
          </h1>
          {purpose && <p className="ad-section-purpose">{purpose}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

export function Panel({ title, hint, children, wide = false }) {
  return (
    <div className={`ad-panel${wide ? ' is-wide' : ''}`}>
      {title && (
        <header className="ad-panel-head">
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </header>
      )}
      {children}
    </div>
  )
}

const MESSAGES = {
  forbidden: 'هذي اللوحة للمالك فقط.',
  not_configured: 'Supabase غير مهيأ في هذي النسخة.',
  unavailable: 'ما قدرنا نجيب المؤشرات. تأكد إن دالة admin-analytics منشورة، ثم حاول مرة ثانية.',
}

/** Renders the shared failure once, so no page has to repeat it. */
export function DataGate({ error, refresh, children }) {
  if (error) return <ErrorState message={MESSAGES[error] ?? MESSAGES.unavailable} onRetry={refresh} />
  return children
}
