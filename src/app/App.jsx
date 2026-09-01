import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { SuperAdminRoute } from '../admin/SuperAdminRoute'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { ScrollToTop } from '../components/ScrollToTop'
import { SkipLink } from '../components/SkipLink'
import { AuthProvider } from '../contexts/AuthContext'
import { ForgotPassword } from '../features/auth/ForgotPassword'
import { Login } from '../features/auth/Login'
import { Register } from '../features/auth/Register'
import { ResetPassword } from '../features/auth/ResetPassword'
import { Faq } from '../pages/Faq'
import { Landing } from '../pages/Landing'
import { NotFound } from '../pages/NotFound'
import { Privacy } from '../pages/Privacy'
import { Terms } from '../pages/Terms'

/* ============================================================
   The signed-in workspace is code-split away from everything public.

   These three screens transitively import @react-pdf/renderer, which is
   the overwhelming majority of this app's JavaScript. Statically imported,
   it was downloaded and parsed by every visitor who ever opened the
   landing page — people who by definition cannot generate a PDF, because
   they are not signed in.

   Splitting at the route boundary rather than deeper keeps the change
   small and reversible: the workspace itself behaves exactly as before,
   it simply arrives in its own chunk at the moment a session exists.
   ============================================================ */
const AppShell = lazy(() => import('./AppShell').then((m) => ({ default: m.AppShell })))
const ChatPage = lazy(() => import('../features/projects/ChatPage').then((m) => ({ default: m.ChatPage })))
const RequirementsReview = lazy(() =>
  import('../features/projects/RequirementsReview').then((m) => ({ default: m.RequirementsReview })),
)
const PrdPreview = lazy(() => import('../features/projects/PrdPreview').then((m) => ({ default: m.PrdPreview })))

/* The owner console is split away for the same reason as the workspace,
   only more so: it is one person's screen. Nobody else should download a
   byte of it, and lazily loading it means nobody does. */
const AdminShell = lazy(() => import('../admin/AdminShell').then((m) => ({ default: m.AdminShell })))
const Overview = lazy(() => import('../admin/pages/Overview').then((m) => ({ default: m.Overview })))
const Acquisition = lazy(() => import('../admin/pages/Acquisition').then((m) => ({ default: m.Acquisition })))
const Activation = lazy(() => import('../admin/pages/Activation').then((m) => ({ default: m.Activation })))
const Engagement = lazy(() => import('../admin/pages/Engagement').then((m) => ({ default: m.Engagement })))
const Quality = lazy(() => import('../admin/pages/Quality').then((m) => ({ default: m.Quality })))
const Retention = lazy(() => import('../admin/pages/Retention').then((m) => ({ default: m.Retention })))
const Revenue = lazy(() => import('../admin/pages/Revenue').then((m) => ({ default: m.Revenue })))
const AiOperations = lazy(() => import('../admin/pages/AiOperations').then((m) => ({ default: m.AiOperations })))
const AdminUsers = lazy(() => import('../admin/pages/Users').then((m) => ({ default: m.Users })))
const AdminProjects = lazy(() => import('../admin/pages/Projects').then((m) => ({ default: m.Projects })))
const AdminPrds = lazy(() => import('../admin/pages/Prds').then((m) => ({ default: m.Prds })))
const Health = lazy(() => import('../admin/pages/Health').then((m) => ({ default: m.Health })))
const AdminSettings = lazy(() => import('../admin/pages/Settings').then((m) => ({ default: m.Settings })))

function App() {
  return (
    <AuthProvider>
      <SkipLink />
      <ScrollToTop />
      {/* Reuses the app's existing loading treatment, so a chunk fetch looks
          identical to the session check that already happens here — not a
          second, unfamiliar spinner. */}
      <Suspense fallback={<div className="page-loading">جارٍ التحميل…</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Public on purpose — the recovery link authenticates the user
              itself, so putting it behind ProtectedRoute would be circular. */}
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:projectId" element={<ChatPage />} />
            <Route path="/chat/:projectId/requirements" element={<RequirementsReview />} />
            <Route path="/chat/:projectId/prd" element={<PrdPreview />} />
          </Route>

          {/* Owner-only. The guard here decides what renders; the actual
              enforcement is the admin-analytics function refusing to
              answer anyone who is not in app_admins, so removing this
              block would change the URL's appearance and nothing else. */}
          <Route
            element={
              <SuperAdminRoute>
                <AdminShell />
              </SuperAdminRoute>
            }
          >
            <Route path="/admin" element={<Overview />} />
            <Route path="/admin/acquisition" element={<Acquisition />} />
            <Route path="/admin/activation" element={<Activation />} />
            <Route path="/admin/engagement" element={<Engagement />} />
            <Route path="/admin/quality" element={<Quality />} />
            <Route path="/admin/retention" element={<Retention />} />
            <Route path="/admin/revenue" element={<Revenue />} />
            <Route path="/admin/ai" element={<AiOperations />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/projects" element={<AdminProjects />} />
            <Route path="/admin/prds" element={<AdminPrds />} />
            <Route path="/admin/health" element={<Health />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

          {/* Catch-all. Without it an unknown URL rendered an empty page. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
