/**
 * Membersページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Members } from '../Members'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  getMembers: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
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

  describe('追加モーダル', () => {
    const openAddModal = async () => {
      fireEvent.click(screen.getByRole('button', { name: /追加/ }))
      return screen.getByRole('dialog')
    }

    const fillAndSubmit = async (dialog: HTMLElement) => {
      fireEvent.change(within(dialog).getByLabelText('名前'), {
        target: { value: 'タロウ' },
      })
      fireEvent.change(within(dialog).getByLabelText('メールアドレス'), {
        target: { value: 'taro@example.com' },
      })
      fireEvent.change(within(dialog).getByLabelText('パスワード'), {
        target: { value: 'password123' },
      })

      // 初回のメンバー一覧取得(loading)が終わり、送信ボタンが有効になるのを待つ
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: '追加' })).not.toBeDisabled()
      })

      fireEvent.click(within(dialog).getByRole('button', { name: '追加' }))
    }

    it('補足文言（メールアドレスとパスワードでログインする旨）が表示される', async () => {
      vi.mocked(api.getMembers).mockResolvedValue({ members: [] })

      renderMembersPage()
      await openAddModal()

      expect(
        screen.getByText('追加したメンバーは、ここで設定したメールアドレスとパスワードでログインします。')
      ).toBeInTheDocument()
    })

    it('メールアドレス重複(409)のときは専用メッセージを表示する', async () => {
      vi.mocked(api.getMembers).mockResolvedValue({ members: [] })
      vi.mocked(api.createMember).mockRejectedValue(new api.ApiError('Conflict', 409))

      renderMembersPage()
      const dialog = await openAddModal()
      await fillAndSubmit(dialog)

      await waitFor(() => {
        expect(
          within(dialog).getByText('このメールアドレスは既に登録されています')
        ).toBeInTheDocument()
      })
    })

    it('409以外のエラーのときは従来どおりAPIのメッセージを表示する', async () => {
      vi.mocked(api.getMembers).mockResolvedValue({ members: [] })
      vi.mocked(api.createMember).mockRejectedValue(new api.ApiError('サーバーエラー', 500))

      renderMembersPage()
      const dialog = await openAddModal()
      await fillAndSubmit(dialog)

      await waitFor(() => {
        expect(within(dialog).getByText('サーバーエラー')).toBeInTheDocument()
      })
    })
  })
})

