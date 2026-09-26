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

// AuthContext.tsx の STORAGE_KEYS.CURRENT_USER と同じ値(export されていないため)
const STORAGE_KEY_CURRENT_USER = 'housework_currentUser'

// テスト用コンポーネント
function TestComponent() {
  const { user, isAuthenticated, login, logout, register, error } = useAuth()

  return (
    <div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <div data-testid="user-role">{user?.role || 'none'}</div>
      <div data-testid="user-tenant">{user?.tenantId || 'none'}</div>
      <div data-testid="error">{error || 'none'}</div>
      <button
        onClick={() =>
          register('山田家', '新規ユーザー', 'new@example.com', 'FATHER', 'password')
        }
      >
        登録
      </button>
      <button onClick={() => login('existing@example.com', 'password')}>ログイン</button>
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
const createMockToken = (
  sub: string,
  role: string,
  expSeconds = 3600,
  tenantId: string | null = 'tenant-1'
) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadObj: Record<string, unknown> = {
    sub,
    name: 'Test User',
    role,
    exp: Math.floor(Date.now() / 1000) + expSeconds,
  }
  if (tenantId !== null) {
    payloadObj.tenantId = tenantId
  }
  const payload = btoa(JSON.stringify(payloadObj))
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

    it('保存済みユーザーに tenantId が無くても、トークンの tenantId で復元される', async () => {
      const token = createMockToken('user-1', 'MOTHER', 3600, 'tenant-from-token')
      vi.mocked(api.getStoredToken).mockReturnValue(token)
      // マルチテナント化より前に保存されたユーザー情報(tenantId なし)
      localStorage.setItem(
        STORAGE_KEY_CURRENT_USER,
        JSON.stringify({ id: 'user-1', name: '保存済みユーザー', email: 'saved@example.com', role: 'MOTHER', createdAt: '2026-01-01T00:00:00Z' })
      )

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('保存済みユーザー')
        expect(screen.getByTestId('user-tenant')).toHaveTextContent('tenant-from-token')
      })
      expect(api.getMember).not.toHaveBeenCalled()
    })

    it('保存済みユーザーがトークンと別のメンバーなら使わず、APIから取得する', async () => {
      const token = createMockToken('user-1', 'MOTHER')
      vi.mocked(api.getStoredToken).mockReturnValue(token)
      localStorage.setItem(
        STORAGE_KEY_CURRENT_USER,
        JSON.stringify({ id: 'other-user', name: '別の人', email: 'other@example.com', role: 'FATHER', tenantId: 'other-tenant', createdAt: '2026-01-01T00:00:00Z' })
      )
      vi.mocked(api.getMember).mockResolvedValue({
        id: 'user-1',
        name: 'APIのユーザー',
        email: 'api@example.com',
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
        expect(screen.getByTestId('user-name')).toHaveTextContent('APIのユーザー')
        expect(screen.getByTestId('user-tenant')).toHaveTextContent('tenant-1')
      })
      expect(api.getMember).toHaveBeenCalledWith('user-1')
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

    it('tenantIdの無い旧トークンならセッションがクリアされログイン画面に戻る', async () => {
      // tenantIdクレームの無い旧トークン
      const token = createMockToken('user-1', 'MOTHER', 3600, null)
      vi.mocked(api.getStoredToken).mockReturnValue(token)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
        expect(screen.getByTestId('user-name')).toHaveTextContent('none')
        expect(api.removeStoredToken).toHaveBeenCalled()
      })
      // tenantIdが無い時点で無効と判定するため、メンバー情報のAPI取得は行われない
      expect(api.getMember).not.toHaveBeenCalled()
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

    it('家族名を含めて登録APIが呼ばれる', async () => {
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
        expect(api.registerApi).toHaveBeenCalledWith(
          expect.objectContaining({ familyName: '山田家' })
        )
      })
    })

    it('メールアドレスが重複している場合(409)は専用のメッセージが表示される', async () => {
      vi.mocked(api.getStoredToken).mockReturnValue(null)
      vi.mocked(api.registerApi).mockRejectedValue(new api.ApiError('Conflict', 409))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      fireEvent.click(screen.getByText('登録'))

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
        expect(screen.getByTestId('error')).toHaveTextContent(
          'このメールアドレスは既に登録されています'
        )
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
      expect(api.loginApi).toHaveBeenCalledWith({ email: 'existing@example.com', password: 'password' })
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
        expect(screen.getByTestId('error')).toHaveTextContent('メールアドレスまたはパスワードが正しくありません')
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

