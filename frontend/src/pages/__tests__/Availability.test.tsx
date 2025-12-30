/**
 * Availabilityページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Availability } from '../Availability'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  getMembers: vi.fn(),
  getMemberAvailabilities: vi.fn(),
  createMemberAvailability: vi.fn(),
  updateMemberAvailability: vi.fn(),
  deleteMemberAvailabilitySlots: vi.fn(),
  getStoredToken: vi.fn(),
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

const renderAvailabilityPage = () => {
  return render(
    <MemoryRouter initialEntries={['/availability']}>
      <AuthProvider>
        <Availability />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Availability', () => {
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
      vi.mocked(api.getMemberAvailabilities).mockResolvedValue({
        availabilities: [],
      })

      const { container } = renderAvailabilityPage()
      expect(container).toBeInTheDocument()
    })
  })
})

