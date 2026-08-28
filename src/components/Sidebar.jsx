import { Link, NavLink } from 'react-router-dom'
import { LOGO_LOCKUP_WHITE } from '../lib/brand'
import { formatRelativeDate, STATUS_LABELS } from '../lib/constants'

/**
 * Fixed, minimal sidebar (Section 9-10). RTL-aware via logical CSS
 * properties in index.css (inset-inline-start/end, margin-inline, etc.) —
 * sits on the right for this app's Arabic/RTL default, would flip to the
 * left automatically if an LTR mode is ever added (Section 38).
 * Collapses to a drawer on mobile (Section 37) via the isOpen/onClose props
 * <AppShell> controls.
 */
export function Sidebar({ projects, loading, user, onSignOut, isOpen, onClose }) {
  return (
    <>
      {isOpen && <button type="button" className="sidebar-backdrop" onClick={onClose} aria-label="إغلاق القائمة" />}
      <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-top">
          {/* The white cut: the sidebar sits on --color-bg (#0a0a0b). One
              lockup image replaces the old mark + typeset "أريب" pair, so
              the brand's own spacing between mark and wordmark is used
              rather than re-approximated in CSS. */}
          <Link to="/chat" className="sidebar-brand" onClick={onClose}>
            <img src={LOGO_LOCKUP_WHITE} alt="أريب" className="sidebar-lockup" />
          </Link>

          <Link to="/chat/new" className="btn btn-primary sidebar-new-btn" onClick={onClose}>
            + مشروع جديد
          </Link>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-title">المشاريع</p>

          {loading && <p className="sidebar-hint">جارٍ التحميل…</p>}
          {!loading && projects.length === 0 && <p className="sidebar-hint">لا توجد مشاريع بعد</p>}

          <ul className="sidebar-project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <NavLink
                  to={`/chat/${project.id}`}
                  className={({ isActive }) => `sidebar-project-row${isActive ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <span className="sidebar-project-dot" aria-hidden="true" />
                  <span className="sidebar-project-info">
                    <span className="sidebar-project-name">{project.name}</span>
                    <span className="sidebar-project-meta">
                      {STATUS_LABELS[project.status] || project.status} · {formatRelativeDate(project.updated_at)}
                    </span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-settings" disabled title="قريباً">
            الإعدادات
          </button>
          <div className="sidebar-profile">
            <span className="sidebar-profile-email">{user?.email}</span>
            <button type="button" className="btn btn-ghost sidebar-signout" onClick={onSignOut}>
              تسجيل الخروج
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
