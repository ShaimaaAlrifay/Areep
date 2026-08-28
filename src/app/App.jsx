import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
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

function App() {
  return (
    <AuthProvider>
      <SkipLink />
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

          {/* Catch-all. Without it an unknown URL rendered an empty page. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
