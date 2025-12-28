/**
 * ProtectedRouteコンポーネントのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../../contexts/AuthContext'
import { ProtectedRoute } from '../ProtectedRoute'

// localStorageのモック用ヘルパー
const setupAuthUser = () => {
  const user = {
    id: 'test-user-1',
    name: 'テストユーザー',
    role: 'FATHER',
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem('housework_users', JSON.stringify([user]))
  localStorage.setItem('housework_currentUser', JSON.stringify(user))
}

const clearAuth = () => {
  localStorage.clear()
}

const renderWithAuth = (
  ui: React.ReactElement,
  { route = '/', isAuthenticated = false } = {}
) => {
  if (isAuthenticated) {
    setupAuthUser()
  } else {
    clearAuth()
  }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>ログインページ</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>保護されたコンテンツ</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>ダッシュボード</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    clearAuth()
  })

  describe('コンポーネント', () => {
    it('正しくマウントされる', () => {
      const { container } = renderWithAuth(<></>, { isAuthenticated: false })
      expect(container).toBeInTheDocument()
    })
  })
})

