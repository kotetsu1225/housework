/**
 * AuthContextのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'

// テスト用コンポーネント
function TestComponent() {
  const { user, isAuthenticated, login, logout, register, getUsers } = useAuth()

  return (
    <div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <div data-testid="user-role">{user?.role || 'none'}</div>
      <div data-testid="users-count">{getUsers().length}</div>
      <button onClick={() => register('テスト太郎', 'FATHER')}>登録</button>
      <button onClick={() => login('テスト太郎')}>ログイン</button>
      <button onClick={logout}>ログアウト</button>
    </div>
  )
}

// プロバイダーなしでuseAuthを呼ぶコンポーネント
function TestWithoutProvider() {
  useAuth()
  return <div>テスト</div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('初期状態', () => {
    it('未認証状態で開始する', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user-name')).toHaveTextContent('none')
    })

    it('localStorageに保存されたユーザーがあれば復元される', async () => {
      const savedUser = {
        id: 'saved-user-1',
        name: '保存済みユーザー',
        role: 'MOTHER',
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('housework_currentUser', JSON.stringify(savedUser))
      localStorage.setItem('housework_users', JSON.stringify([savedUser]))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
        expect(screen.getByTestId('user-name')).toHaveTextContent('保存済みユーザー')
      })
    })
  })

  describe('register', () => {
    it('新規ユーザーを登録できる', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        fireEvent.click(screen.getByText('登録'))
      })

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('user-name')).toHaveTextContent('テスト太郎')
      expect(screen.getByTestId('user-role')).toHaveTextContent('FATHER')
    })

    it('登録後にlocalStorageに保存される', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        fireEvent.click(screen.getByText('登録'))
      })

      const users = JSON.parse(localStorage.getItem('housework_users') || '[]')
      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('テスト太郎')
    })

    it('複数ユーザーを登録できる', async () => {
      // 最初のユーザーを手動で追加
      const firstUser = {
        id: 'first-user',
        name: '最初のユーザー',
        role: 'BROTHER',
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('housework_users', JSON.stringify([firstUser]))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        fireEvent.click(screen.getByText('登録'))
      })

      expect(screen.getByTestId('users-count')).toHaveTextContent('2')
    })
  })

  describe('login', () => {
    it('既存ユーザーでログインできる', async () => {
      const existingUser = {
        id: 'existing-user',
        name: 'テスト太郎',
        role: 'FATHER',
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('housework_users', JSON.stringify([existingUser]))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        fireEvent.click(screen.getByText('ログイン'))
      })

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('user-name')).toHaveTextContent('テスト太郎')
    })

    it('存在しないユーザーではログインできない', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        fireEvent.click(screen.getByText('ログイン'))
      })

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    })
  })

  describe('logout', () => {
    it('ログアウトできる', async () => {
      const user = {
        id: 'test-user',
        name: 'テスト太郎',
        role: 'FATHER',
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('housework_users', JSON.stringify([user]))
      localStorage.setItem('housework_currentUser', JSON.stringify(user))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      })

      await act(async () => {
        fireEvent.click(screen.getByText('ログアウト'))
      })

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user-name')).toHaveTextContent('none')
    })

    it('ログアウト後にlocalStorageからcurrentUserが削除される', async () => {
      const user = {
        id: 'test-user',
        name: 'テスト太郎',
        role: 'FATHER',
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('housework_users', JSON.stringify([user]))
      localStorage.setItem('housework_currentUser', JSON.stringify(user))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      })

      await act(async () => {
        fireEvent.click(screen.getByText('ログアウト'))
      })

      expect(localStorage.getItem('housework_currentUser')).toBeNull()
      // ユーザー一覧は削除されない
      expect(localStorage.getItem('housework_users')).not.toBeNull()
    })
  })

  describe('getUsers', () => {
    it('ユーザー一覧を取得できる', () => {
      const users = [
        { id: '1', name: 'ユーザー1', role: 'FATHER', createdAt: new Date().toISOString() },
        { id: '2', name: 'ユーザー2', role: 'MOTHER', createdAt: new Date().toISOString() },
      ]
      localStorage.setItem('housework_users', JSON.stringify(users))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('users-count')).toHaveTextContent('2')
    })

    it('ユーザーがいない場合は空配列を返す', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('users-count')).toHaveTextContent('0')
    })
  })

  describe('エラーハンドリング', () => {
    it('AuthProvider外でuseAuthを使うとエラーになる', () => {
      expect(() => render(<TestWithoutProvider />)).toThrow(
        'useAuth must be used within an AuthProvider'
      )
    })

    it('不正なJSONがlocalStorageにあっても安全に処理される', () => {
      localStorage.setItem('housework_currentUser', 'invalid-json')

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // エラーなく未認証状態になる
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    })
  })
})

