/**
 * Registerページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Register } from '../Register'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  registerApi: vi.fn(),
  getStoredToken: vi.fn(),
  setStoredToken: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

// JWTペイロードのモック作成ヘルパー
const createMockToken = (sub: string, role: string, tenantId: string | null = 'tenant-1') => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadObj: Record<string, unknown> = {
    sub,
    name: 'Test User',
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  if (tenantId !== null) {
    payloadObj.tenantId = tenantId
  }
  const payload = btoa(JSON.stringify(payloadObj))
  return `${header}.${payload}.signature`
}

const renderRegisterPage = (route = '/register') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<div>ログインページ</div>} />
          <Route path="/" element={<div>ホームページ</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Register', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(api.getStoredToken).mockReturnValue(null)
  })

  describe('レンダリング', () => {
    it('登録フォームが表示される', () => {
      renderRegisterPage()
      expect(screen.getByRole('heading', { name: '家族を新しく作る' })).toBeInTheDocument()
      expect(screen.getByLabelText('家族の名前')).toBeInTheDocument()
      expect(screen.getByLabelText('名前')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
    })

    it('2人目以降の家族はメンバー画面から追加する旨の補足が表示される', () => {
      renderRegisterPage()
      expect(
        screen.getByText(/2人目以降の家族は、ログイン後にメンバー画面から追加します。/)
      ).toBeInTheDocument()
    })

    it('4つの役割選択肢が表示される', () => {
      renderRegisterPage()
      expect(screen.getByText('父')).toBeInTheDocument()
      expect(screen.getByText('母')).toBeInTheDocument()
      expect(screen.getByText('兄')).toBeInTheDocument()
      expect(screen.getByText('妹')).toBeInTheDocument()
    })

    it('ログインリンクが表示される', () => {
      renderRegisterPage()
      expect(screen.getByText('ログイン')).toBeInTheDocument()
    })
  })

  describe('役割選択', () => {
    it('デフォルトで父が選択されている', () => {
      renderRegisterPage()
      const fatherButton = screen.getByRole('button', { name: /父/ })
      expect(fatherButton).toHaveClass('border-coral-500')
    })

    it('役割を変更できる', async () => {
      renderRegisterPage()
      fireEvent.click(screen.getByRole('button', { name: /母/ }))
      
      await waitFor(() => {
        const motherButton = screen.getByRole('button', { name: /母/ })
        expect(motherButton).toHaveClass('border-coral-500')
      })
    })
  })

  describe('バリデーション', () => {
    const fillOtherFields = () => {
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'test' } })
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), { target: { value: 'password' } })
    }

    it('家族の名前が空の場合ボタンが無効化され送信されない', async () => {
      renderRegisterPage()
      fillOtherFields()

      const button = screen.getByRole('button', { name: '登録する' })
      expect(button).toBeDisabled()

      fireEvent.click(button)
      expect(api.registerApi).not.toHaveBeenCalled()
    })

    it('家族の名前が空白のみの場合ボタンが無効化され送信されない', async () => {
      renderRegisterPage()
      fillOtherFields()
      fireEvent.change(screen.getByLabelText('家族の名前'), { target: { value: '   ' } })

      const button = screen.getByRole('button', { name: '登録する' })
      expect(button).toBeDisabled()

      fireEvent.click(button)
      expect(api.registerApi).not.toHaveBeenCalled()
    })

    it('家族の名前が256文字の場合ボタンが無効化され送信されない', async () => {
      renderRegisterPage()
      fillOtherFields()
      fireEvent.change(screen.getByLabelText('家族の名前'), { target: { value: 'a'.repeat(256) } })

      const button = screen.getByRole('button', { name: '登録する' })
      expect(button).toBeDisabled()

      fireEvent.click(button)
      expect(api.registerApi).not.toHaveBeenCalled()
    })

    it('名前が空の場合ボタンが無効化される', async () => {
      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), { target: { value: 'password' } })
      
      const button = screen.getByRole('button', { name: '登録する' })
      expect(button).toBeDisabled()
    })

    it('パスワードが一致しない場合ボタンが無効化される', async () => {
      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'test' } })
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), { target: { value: 'drowssap' } })
      
      const button = screen.getByRole('button', { name: '登録する' })
      expect(button).toBeDisabled()
    })
  })

  describe('登録処理', () => {
    it('登録成功するとホームに遷移する', async () => {
      const token = createMockToken('new-user', 'FATHER')
      vi.mocked(api.registerApi).mockResolvedValue({
        token,
        memberId: 'new-user',
        memberName: '新規ユーザー',
        role: 'FATHER'
      })

      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('家族の名前'), { target: { value: '山田家' } })
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '新規ユーザー' } })
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'new@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), { target: { value: 'password' } })

      fireEvent.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(screen.getByText('ホームページ')).toBeInTheDocument()
      })
      expect(api.setStoredToken).toHaveBeenCalledWith(token)
    })

    it('家族名を含めて登録リクエストが送られる', async () => {
      const token = createMockToken('new-user', 'FATHER')
      vi.mocked(api.registerApi).mockResolvedValue({
        token,
        memberId: 'new-user',
        memberName: '新規ユーザー',
        role: 'FATHER'
      })

      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('家族の名前'), { target: { value: '山田家' } })
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '新規ユーザー' } })
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'new@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), { target: { value: 'password' } })

      fireEvent.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(api.registerApi).toHaveBeenCalledWith(
          expect.objectContaining({ familyName: '山田家' })
        )
      })
    })

    it('登録失敗時にエラーが表示される', async () => {
      vi.mocked(api.registerApi).mockRejectedValue(new Error('登録エラー'))

      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('家族の名前'), { target: { value: '山田家' } })
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '新規ユーザー' } })
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'new@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), { target: { value: 'password' } })

      fireEvent.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(screen.getByText('登録エラー')).toBeInTheDocument()
      })
    })
  })

  describe('ナビゲーション', () => {
    it('ログインリンクをクリックするとログインページに遷移する', async () => {
      renderRegisterPage()
      fireEvent.click(screen.getByText('ログイン'))
      
      await waitFor(() => {
        expect(screen.getByText('ログインページ')).toBeInTheDocument()
      })
    })
  })
})

