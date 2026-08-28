import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Sidebar } from '../components/Sidebar'
import { useAuthContext } from '../contexts/AuthContext'
import { useOrganization } from '../hooks/useOrganization'
import { useProjects } from '../hooks/useProjects'

/**
 * Wires the sidebar + routed chat content together. Owns the one
 * `useProjects` fetch for the signed-in org and hands it down to routed
 * pages via Outlet context, so the sidebar and the chat page never drift
 * out of sync (e.g. a just-created project shows up in both immediately).
 */
export function AppShell() {
  const { user, signOut } = useAuthContext()
  const navigate = useNavigate()
  const { organizationId } = useOrganization(user)
  const { projects, loading, refetch } = useProjects(organizationId)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {/* One noindex for the whole workspace rather than one per screen.
          Every route under this shell is a signed-in surface holding a
          user's client work — none of it may ever reach a search index, and
          declaring that once here means a new /chat route cannot be added
          without inheriting the protection. It is also the last <Seo> to
          run (React flushes child effects before parent ones), so a page
          below cannot accidentally undo it. */}
      <Seo title="مساحة العمل" noindex />
      <button type="button" className="mobile-menu-btn" onClick={() => setDrawerOpen(true)} aria-label="فتح القائمة">
        <MenuIcon />
      </button>

      <Sidebar
        projects={projects}
        loading={loading}
        user={user}
        onSignOut={handleSignOut}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <main className="app-main" id="main">
        <Outlet context={{ organizationId, projects, projectsLoading: loading, refetchProjects: refetch }} />
      </main>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
