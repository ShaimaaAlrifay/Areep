import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AuthProvider } from '../contexts/AuthContext'
import { ForgotPassword } from '../features/auth/ForgotPassword'
import { Login } from '../features/auth/Login'
import { Register } from '../features/auth/Register'
import { ChatPage } from '../features/projects/ChatPage'
import { PrdPreview } from '../features/projects/PrdPreview'
import { RequirementsReview } from '../features/projects/RequirementsReview'
import { Landing } from '../pages/Landing'
import { AppShell } from './AppShell'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

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
      </Routes>
    </AuthProvider>
  )
}

export default App
