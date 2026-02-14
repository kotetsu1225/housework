import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import { BottomNav } from './components/layout/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { TaskList } from './pages/TaskList'
import { Members } from './pages/Members'
import { MemberDetail } from './pages/MemberDetail'
import { CompletedExecutions } from './pages/CompletedExecutions'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { NotFound } from './pages/NotFound'

const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })))

/**
 * アプリ初期化中のローディング画面
 */
function AppLoading() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-coral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/50">読み込み中...</p>
      </div>
    </div>
  )
}

function AppContent() {
  const { isAuthenticated, isInitializing } = useAuth()

  // セッション復元中はローディング表示
  if (isInitializing) {
    return <AppLoading />
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Routes>
        {/* Public routes */}
        <Route path="/landing" element={
          <Suspense fallback={<AppLoading />}>
            <Landing />
          </Suspense>
        } />
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
          path="/tasks/list"
          element={
            <ProtectedRoute>
              <TaskList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/executions/completed"
          element={
            <ProtectedRoute>
              <CompletedExecutions />
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
          path="/members/:memberId"
          element={
            <ProtectedRoute>
              <MemberDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members/:memberId/completed"
          element={
            <ProtectedRoute>
              <CompletedExecutions />
            </ProtectedRoute>
          }
        />

        {/* 404 - 存在しないルート */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {isAuthenticated && <BottomNav />}
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
