/**
 * Availabilityページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Availability } from '../Availability'
import * as api from '../../api'

// AuthContextをモック
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      name: 'テストユーザー',
      role: 'FATHER',
    },
    isAuthenticated: true,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

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
  // Mocking useAuth handles this now
}

const renderAvailabilityPage = () => {
  return render(
    <MemoryRouter initialEntries={['/availability']}>
      <Availability />
    </MemoryRouter>
  )
}

describe('Availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  describe('空き時間の追加', () => {
    it('既存の空き時間がある場合、APIのupdateエンドポイントが呼ばれる', async () => {
      const existingAvailabilityId = 'avail-123'
      const memberId = 'test-user'
      const targetDate = new Date().toISOString().split('T')[0] // Today

      vi.mocked(api.getMembers).mockResolvedValue({
        members: [{ id: memberId, name: 'テストユーザー', role: 'FATHER' }],
      })
      
      // 既存の空き時間をモック
      vi.mocked(api.getMemberAvailabilities).mockResolvedValue({
        availabilities: [
          {
            id: existingAvailabilityId,
            memberId: memberId,
            targetDate: targetDate,
            slots: [{ startTime: '10:00', endTime: '12:00', memo: '既存' }],
          },
        ],
      })

      // updateAPIのレスポンスをモック
      vi.mocked(api.updateMemberAvailability).mockResolvedValue({
        id: existingAvailabilityId,
        memberId: memberId,
        targetDate: targetDate,
        slots: [
          { startTime: '10:00', endTime: '12:00', memo: '既存' },
          { startTime: '13:00', endTime: '15:00', memo: '新規' },
        ],
      })

      renderAvailabilityPage()

      // メンバー情報のロードと空き時間の取得を待つ
      await waitFor(() => {
        expect(api.getMembers).toHaveBeenCalled()
      })
      
      // 空き時間が表示されるのを待つ
      await screen.findByText('既存')

      // 「登録」ボタンをクリックしてモーダルを開く
      // ヘッダーの「登録」ボタンをクリック
      const headerRegisterButton = screen.getByRole('button', { name: /^登録$/ })
      fireEvent.click(headerRegisterButton)

      // フォームに入力
      const startTimeInput = screen.getByLabelText('開始時刻')
      const endTimeInput = screen.getByLabelText('終了時刻')
      const memoInput = screen.getByLabelText('メモ')

      fireEvent.change(startTimeInput, { target: { value: '13:00' } })
      fireEvent.change(endTimeInput, { target: { value: '15:00' } })
      fireEvent.change(memoInput, { target: { value: '新規' } })

      // モーダルの「登録」ボタンをクリック
      // Note: role="dialog"内のボタンを探すのが確実だが、ここではテキストで検索
      const submitButton = screen.getAllByRole('button', { name: '登録' })[1] // 0番目はヘッダーのボタン
      fireEvent.click(submitButton)

      // updateMemberAvailabilityが呼ばれたことを確認
      await waitFor(() => {
        expect(api.updateMemberAvailability).toHaveBeenCalledWith(
          existingAvailabilityId,
          {
            slots: [
              { startTime: '13:00', endTime: '15:00', memo: '新規' }
            ]
          }
        )
      })
    })
  })
})

