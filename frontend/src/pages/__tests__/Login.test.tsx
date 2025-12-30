/**
 * Loginページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Login } from '../Login'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  loginApi: vi.fn(),
  getStoredToken: vi.fn(),
  getMember: vi.fn(),
  setStoredToken: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

// JWTペイロードのモック作成ヘルパー
const createMockToken = (sub: string, role: string) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      sub,
      name: 'Test User',
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  )
  return `${header}.${payload}.signature`
}

const renderLoginPage = (route = '/login') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<div>新規登録ページ</div>} />
          <Route path="/" element={<div>ホームページ</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(api.getStoredToken).mockReturnValue(null)
  })

  describe('レンダリング', () => {
    it('ログインフォームが表示される', () => {
      renderLoginPage()
      // 見出しを確認（複数あるので getAllByRole を使用）
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
      expect(screen.getByLabelText('名前')).toBeInTheDocument()
    })

    it('新規登録リンクが表示される', () => {
      renderLoginPage()
      expect(screen.getByText('新規登録')).toBeInTheDocument()
    })
  })

  describe('バリデーション', () => {
    it('名前が空の場合ボタンが無効化される', async () => {
      renderLoginPage()
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      
      const button = screen.getByRole('button', { name: 'ログイン' })
      expect(button).toBeDisabled()
    })

    it('パスワードが短すぎる場合ボタンが無効化される', async () => {
      renderLoginPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'user' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: '1234' } }) // 5文字未満
      
      const button = screen.getByRole('button', { name: 'ログイン' })
      expect(button).toBeDisabled()
    })
  })

  describe('ログイン処理', () => {
    it('認証エラー時にエラーメッセージが表示される', async () => {
      vi.mocked(api.loginApi).mockRejectedValue(new api.ApiError('認証失敗', 401))

      renderLoginPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '存在しないユーザー' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      
      const button = screen.getByRole('button', { name: 'ログイン' })
      expect(button).not.toBeDisabled()
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('名前またはパスワードが正しくありません')).toBeInTheDocument()
      })
    })

    it('存在するユーザーでログインするとホームに遷移する', async () => {
      const token = createMockToken('test-user', 'FATHER')
      vi.mocked(api.loginApi).mockResolvedValue({
        token,
        memberId: 'test-user',
        memberName: 'テストユーザー',
        role: 'FATHER'
      })
      vi.mocked(api.getMember).mockResolvedValue({
        id: 'test-user',
        name: 'テストユーザー',
        email: 'test@example.com',
        familyRole: 'FATHER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      renderLoginPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'テストユーザー' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } })
      
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
      
      await waitFor(() => {
        expect(screen.getByText('ホームページ')).toBeInTheDocument()
      })
    })
  })

  describe('ナビゲーション', () => {
    it('新規登録リンクをクリックすると登録ページに遷移する', async () => {
      renderLoginPage()
      fireEvent.click(screen.getByText('新規登録'))
      
      await waitFor(() => {
        expect(screen.getByText('新規登録ページ')).toBeInTheDocument()
      })
    })
  })
})

