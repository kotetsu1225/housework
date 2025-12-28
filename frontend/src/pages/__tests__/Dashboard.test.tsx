/**
 * Dashboardページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Dashboard } from '../Dashboard'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  getTaskExecutions: vi.fn(),
  getMembers: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

const setupAuthUser = () => {
  const user = {
    id: 'test-user',
    name: 'テストユーザー',
    role: 'FATHER',
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem('housework_users', JSON.stringify([user]))
  localStorage.setItem('housework_currentUser', JSON.stringify(user))
}

const renderDashboard = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupAuthUser()
  })

  describe('レンダリング', () => {
    it('ページが正しくマウントされる', () => {
      vi.mocked(api.getTaskExecutions).mockResolvedValue({
        taskExecutions: [],
        total: 0,
        limit: 20,
        offset: 0,
      })
      vi.mocked(api.getMembers).mockResolvedValue({
        members: [],
      })

      const { container } = renderDashboard()
      expect(container).toBeInTheDocument()
    })
  })
})

