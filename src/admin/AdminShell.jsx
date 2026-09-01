import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { LOGO_MARK_WHITE } from '../lib/brand'
import { useAuthContext } from '../contexts/AuthContext'
import { COMPARE_MODES, PRESETS } from './analytics/ranges'
import { buildInsights } from './analytics/insights'
import { useAnalytics } from './useAnalytics'
/* Imported here, not globally: the stylesheet rides the same lazy chunk
   as the console, so a visitor who never opens /admin never fetches it. */
import '../styles/admin.css'

/* ============================================================
   The command center frame: navigation on one side, a global control bar
   across the top, one routed section in the middle.

   The date range and comparison live here rather than on each page, and
   they are the only global controls, because they are the only two
   choices that change the meaning of every number below them. Everything
   else a section needs, that section owns.

   One data fetch for the whole console, handed down through Outlet
   context. Sections are pure readers — no page issues its own query — so
   switching between Activation and Retention cannot show two different
   versions of the same week.
   ============================================================ */

/* Grouped rather than one flat list: the funnel stages (Overview through
   AI Operations) are what the owner reads top-to-bottom on a normal day;
   the entity browsers (Users/Projects/PRDs) are lookups, not a narrative;
   System Health and Settings are operational, not analytical. A divider
   between the three says that without a label having to. */
const NAV_GROUPS = [
  [
    { to: '/admin', end: true, label: 'نظرة عامة', en: 'Overview', icon: 'grid' },
    { to: '/admin/acquisition', label: 'الاستحواذ', en: 'Acquisition', icon: 'arrow' },
    { to: '/admin/activation', label: 'التفعيل', en: 'Activation', icon: 'spark' },
    { to: '/admin/engagement', label: 'التفاعل', en: 'Engagement', icon: 'chat' },
    { to: '/admin/quality', label: 'الجودة', en: 'Quality', icon: 'check' },
    { to: '/admin/retention', label: 'الاحتفاظ', en: 'Retention', icon: 'repeat' },
    { to: '/admin/revenue', label: 'الإيراد', en: 'Revenue', icon: 'coin' },
    { to: '/admin/ai', label: 'عمليات الذكاء الاصطناعي', en: 'AI Operations', icon: 'cpu' },
  ],
  [
    { to: '/admin/users', label: 'المستخدمون', en: 'Users', icon: 'users' },
    { to: '/admin/projects', label: 'المشاريع', en: 'Projects', icon: 'folder' },
    { to: '/admin/prds', label: 'الوثائق', en: 'PRDs', icon: 'doc' },
  ],
  [
    { to: '/admin/health', label: 'صحة النظام', en: 'System Health', icon: 'pulse' },
    { to: '/admin/settings', label: 'الإعدادات', en: 'Settings', icon: 'gear' },
  ],
]

export function AdminShell() {
  const { user } = useAuthContext()
  const [preset, setPreset] = useState('30d')
  const [compare, setCompare] = useState('previous')
  const [navOpen, setNavOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState({ from: '', to: '' })
  const [customRange, setCustomRange] = useState(null)

  const { metrics, loading, error, range, refresh } = useAnalytics(preset, compare, customRange)

  const applyCustomRange = () => {
    if (!customDraft.from || !customDraft.to) return
    setCustomRange({ ...customDraft })
    setCustomOpen(false)
  }
  const selectPreset = (id) => {
    setCustomRange(null)
    setPreset(id)
    setCustomOpen(false)
  }
  const insights = buildInsights(metrics)
  const urgent = insights.filter((i) => i.level !== 'good')

  /* Downloads exactly what selectMetrics() computed for the visible
     range — the same numbers on screen, not a second query. Nothing here
     that isn't already privacy-safe: the payload has never carried an
     email, a name, or a project title. */
  const handleExport = () => {
    if (!metrics) return
    const blob = new Blob([JSON.stringify({ range, metrics }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `areep-analytics-${range?.preset?.id ?? 'export'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="ad" dir="rtl">
      {/* The console is a private surface over every customer's aggregate
          behaviour. It must never be indexed, and saying so once here
          covers every section added later. */}
      <Seo title="لوحة القيادة" noindex />

      <aside className={`ad-sidebar${navOpen ? ' is-open' : ''}`}>
        <div className="ad-brand">
          <img src={LOGO_MARK_WHITE} alt="" width="24" height="27" />
          <span>
            أريب
            <em>Product Intelligence</em>
          </span>
        </div>

        <nav className="ad-nav" aria-label="أقسام اللوحة">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="ad-nav-group">
              {gi > 0 && <hr className="ad-nav-divider" />}
              {group.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `ad-nav-item${isActive ? ' is-active' : ''}`}
                  onClick={() => setNavOpen(false)}
                >
                  <NavIcon name={item.icon} />
                  <span className="ad-nav-label">{item.label}</span>
                  <span className="ad-nav-en">{item.en}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="ad-sidebar-foot">
          <span className="ad-owner-badge">وضع المالك</span>
          <span className="ad-owner-mail" title={user?.email}>
            {user?.email}
          </span>
        </div>
      </aside>

      {navOpen && <button type="button" className="ad-scrim" aria-label="إغلاق القائمة" onClick={() => setNavOpen(false)} />}

      <div className="ad-main">
        <header className="ad-topbar">
          <button type="button" className="ad-icon-btn ad-nav-toggle" onClick={() => setNavOpen(true)} aria-label="فتح القائمة">
            <NavIcon name="menu" />
          </button>

          <div className="ad-range" role="group" aria-label="الفترة الزمنية">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`ad-range-btn${!customRange && preset === p.id ? ' is-active' : ''}`}
                onClick={() => selectPreset(p.id)}
                aria-pressed={!customRange && preset === p.id}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`ad-range-btn${customRange ? ' is-active' : ''}`}
              onClick={() => setCustomOpen((v) => !v)}
              aria-expanded={customOpen}
            >
              مخصّص
            </button>
          </div>



          <label className="ad-compare">
            <span className="ad-sr">المقارنة</span>
            <select value={compare} onChange={(e) => setCompare(e.target.value)}>
              {COMPARE_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <div className="ad-topbar-actions">
            <button
              type="button"
              className={`ad-icon-btn${urgent.length ? ' has-alerts' : ''}`}
              onClick={() => setAlertsOpen((v) => !v)}
              aria-label={`التنبيهات${urgent.length ? ` (${urgent.length})` : ''}`}
              aria-expanded={alertsOpen}
            >
              <NavIcon name="bell" />
              {urgent.length > 0 && <b className="ad-badge">{urgent.length}</b>}
            </button>
            <button
              type="button"
              className="ad-icon-btn"
              onClick={handleExport}
              aria-label="تصدير البيانات الحالية"
              disabled={loading || !metrics}
              title="تصدير المؤشرات المعروضة كملف JSON"
            >
              <NavIcon name="download" />
            </button>
            <button type="button" className="ad-icon-btn" onClick={refresh} aria-label="تحديث البيانات" disabled={loading}>
              <NavIcon name="refresh" />
            </button>
          </div>
        </header>

          {customOpen && (
            <div className="ad-custom-range">
              <label>
                من
                <input type="date" value={customDraft.from} onChange={(e) => setCustomDraft((d) => ({ ...d, from: e.target.value }))} />
              </label>
              <label>
                إلى
                <input type="date" value={customDraft.to} onChange={(e) => setCustomDraft((d) => ({ ...d, to: e.target.value }))} />
              </label>
              <button type="button" className="ad-btn" onClick={applyCustomRange} disabled={!customDraft.from || !customDraft.to}>
                تطبيق
              </button>
            </div>
          )}

        {alertsOpen && (
          <div className="ad-alerts-drop">
            {urgent.length === 0 ? (
              <p className="ad-inline-empty">ما فيه تنبيهات. كل المؤشرات المتابَعة ضمن حدودها.</p>
            ) : (
              <ul>
                {urgent.map((a) => (
                  <li key={a.id} className={`ad-alert ad-alert-${a.level}`}>
                    <strong>{a.title}</strong>
                    <span>{a.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <main className="ad-content" id="main">
          <Outlet context={{ metrics, loading, error, range, insights, refresh }} />
        </main>
      </div>
    </div>
  )
}

/* One inline sprite instead of an icon dependency — thirteen glyphs do
   not justify a package, and these inherit currentColor for free. */
const PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  arrow: 'M12 19V5M12 5l-6 6M12 5l6 6',
  spark: 'M13 2 4 14h7l-1 8 9-12h-7z',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z',
  check: 'M20 6 9 17l-5-5',
  repeat: 'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  coin: 'M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6',
  cpu: 'M6 6h12v12H6zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  doc: 'M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zM14 2v5h5M9 13h6M9 17h4',
  pulse: 'M3 12h4l3 8 4-16 3 8h4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 4.3 6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  refresh: 'M21 12a9 9 0 1 1-3-6.7M21 3v6h-6',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
}

function NavIcon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={PATHS[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
