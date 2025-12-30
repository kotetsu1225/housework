/**
 * AuthContextのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  loginApi: vi.fn(),
  registerApi: vi.fn(),
  getMember: vi.fn(),
  getStoredToken: vi.fn(),
  setStoredToken: vi.fn(),
  removeStoredToken: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

// テスト用コンポーネント
function TestComponent() {
  const { user, isAuthenticated, login, logout, register, error } = useAuth()

  return (
    <div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <div data-testid="user-role">{user?.role || 'none'}</div>
      <div data-testid="error">{error || 'none'}</div>
      <button onClick={() => register('新規ユーザー', 'new@example.com', 'FATHER', 'password')}>
        登録
      </button>
      <button onClick={() => login('既存ユーザー', 'password')}>ログイン</button>
      <button onClick={logout}>ログアウト</button>
    </div>
  )
}

// プロバイダーなしでuseAuthを呼ぶコンポーネント
function TestWithoutProvider() {
  useAuth()
  return <div>テスト</div>
}

// JWTペイロードのモック作成ヘルパー
const createMockToken = (sub: string, role: string, expSeconds = 3600) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      sub,
      name: 'Test User',
      role,
      exp: Math.floor(Date.now() / 1000) + expSeconds,
    })
  )
  return `${header}.${payload}.signature`
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初期状態', () => {
    it('未認証状態で開始する（トークンなし）', async () => {
      vi.mocked(api.getStoredToken).mockReturnValue(null)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
        expect(screen.getByTestId('user-name')).toHaveTextContent('none')
      })
    })

    it('有効なトークンがあれば復元される', async () => {
      const token = createMockToken('user-1', 'MOTHER')
      vi.mocked(api.getStoredToken).mockReturnValue(token)
      vi.mocked(api.getMember).mockResolvedValue({
        id: 'user-1',
        name: '保存済みユーザー',
        email: 'saved@example.com',
        familyRole: 'MOTHER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
        expect(screen.getByTestId('user-name')).toHaveTextContent('保存済みユーザー')
        expect(screen.getByTestId('user-role')).toHaveTextContent('MOTHER')
      })
    })

    it('トークンが無効ならセッションがクリアされる', async () => {
      // 期限切れトークン
      const token = createMockToken('user-1', 'MOTHER', -3600)
      vi.mocked(api.getStoredToken).mockReturnValue(token)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
        expect(api.removeStoredToken).toHaveBeenCalled()
      })
    })
  })

  describe('register', () => {
    it('新規ユーザーを登録できる', async () => {
      vi.mocked(api.getStoredToken).mockReturnValue(null)
      const token = createMockToken('new-user', 'FATHER')
      
      vi.mocked(api.registerApi).mockResolvedValue({
        token,
        memberId: 'new-user',
        memberName: '新規ユーザー',
        role: 'FATHER',
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      fireEvent.click(screen.getByText('登録'))

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
        expect(screen.getByTestId('user-name')).toHaveTextContent('新規ユーザー')
        expect(screen.getByTestId('user-role')).toHaveTextContent('FATHER')
        expect(api.setStoredToken).toHaveBeenCalledWith(token)
      })
    })

    it('登録に失敗した場合はエラーが表示される', async () => {
      vi.mocked(api.getStoredToken).mockReturnValue(null)
      vi.mocked(api.registerApi).mockRejectedValue(new Error('登録エラー'))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      fireEvent.click(screen.getByText('登録'))

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
        expect(screen.getByTestId('error')).toHaveTextContent('登録エラー')
      })
    })
  })

  describe('login', () => {
    it('既存ユーザーでログインできる', async () => {
      vi.mocked(api.getStoredToken).mockReturnValue(null)
      const token = createMockToken('existing-user', 'FATHER')
      
      vi.mocked(api.loginApi).mockResolvedValue({
        token,
        memberId: 'existing-user',
        memberName: '既存ユーザー',
        role: 'FATHER',
      })
      
      vi.mocked(api.getMember).mockResolvedValue({
        id: 'existing-user',
        name: '既存ユーザー',
        email: 'existing@example.com',
        familyRole: 'FATHER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      fireEvent.click(screen.getByText('ログイン'))

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
        expect(screen.getByTestId('user-name')).toHaveTextContent('既存ユーザー')
        expect(api.setStoredToken).toHaveBeenCalledWith(token)
      })
    })

    it('ログイン失敗時にエラーが表示される', async () => {
      vi.mocked(api.getStoredToken).mockReturnValue(null)
      vi.mocked(api.loginApi).mockRejectedValue(new api.ApiError('認証失敗', 401))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      fireEvent.click(screen.getByText('ログイン'))

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
        expect(screen.getByTestId('error')).toHaveTextContent('名前またはパスワードが正しくありません')
      })
    })
  })

  describe('logout', () => {
    it('ログアウトできる', async () => {
      const token = createMockToken('user-1', 'MOTHER')
      vi.mocked(api.getStoredToken).mockReturnValue(token)
      vi.mocked(api.getMember).mockResolvedValue({
        id: 'user-1',
        name: 'ユーザー',
        email: 'user@example.com',
        familyRole: 'MOTHER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      })

      fireEvent.click(screen.getByText('ログアウト'))

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
        expect(screen.getByTestId('user-name')).toHaveTextContent('none')
        expect(api.removeStoredToken).toHaveBeenCalled()
      })
    })
  })

  describe('エラーハンドリング', () => {
    it('AuthProvider外でuseAuthを使うとエラーになる', () => {
      expect(() => render(<TestWithoutProvider />)).toThrow(
        'useAuth must be used within an AuthProvider'
      )
    })
  })
})

