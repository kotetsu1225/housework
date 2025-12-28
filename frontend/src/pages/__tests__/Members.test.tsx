/**
 * Membersページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Members } from '../Members'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  getMembers: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
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

const renderMembersPage = () => {
  return render(
    <MemoryRouter initialEntries={['/members']}>
      <AuthProvider>
        <Members />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Members', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupAuthUser()
  })

  describe('レンダリング', () => {
    it('ページが正しくマウントされる', () => {
      vi.mocked(api.getMembers).mockResolvedValue({
        members: [],
      })

      const { container } = renderMembersPage()
      expect(container).toBeInTheDocument()
    })
  })
})

