import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { BottomNav } from './components/layout/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Members } from './pages/Members'
import { Availability } from './pages/Availability'
import { Login } from './pages/Login'
import { Register } from './pages/Register'

function AppContent() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-dark-950">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members"
          element={
            <ProtectedRoute>
              <Members />
            </ProtectedRoute>
          }
        />
        <Route
          path="/availability"
          element={
            <ProtectedRoute>
              <Availability />
            </ProtectedRoute>
          }
        />
      </Routes>
      {isAuthenticated && <BottomNav />}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
