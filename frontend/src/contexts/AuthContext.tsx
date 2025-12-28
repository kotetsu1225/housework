/**
 * 認証コンテキスト
 *
 * メンバー認証の状態管理とバックエンドAPI連携を提供
 * @see backend/src/main/kotlin/com/task/presentation/Members.kt
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { getMembers, createMember, ApiError } from '../api'
import type { User, FamilyRole } from '../types'

/** ローカルストレージのキー */
const STORAGE_KEYS = {
  CURRENT_USER: 'housework_currentUser',
} as const

/**
 * 認証コンテキストの型定義
 */
interface AuthContextType {
  /** 現在のユーザー */
  user: User | null
  /** 認証状態 */
  isAuthenticated: boolean
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
  /**
   * ログイン（バックエンドのメンバー一覧から検索）
   * @param name - メンバー名
   * @returns ログイン成功したかどうか
   */
  login: (name: string) => Promise<boolean>
  /** ログアウト */
  logout: () => void
  /**
   * 新規登録（バックエンドにメンバーを作成）
   * @param name - メンバー名
   * @param role - 家族の役割
   * @returns 登録成功したかどうか
   */
  register: (name: string, role: FamilyRole) => Promise<boolean>
  /** エラーをクリア */
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * 認証プロバイダー
 *
 * アプリケーション全体で認証状態を管理します。
 * バックエンドのMember APIと連携し、ログイン・登録機能を提供します。
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <AppContent />
 *     </AuthProvider>
 *   )
 * }
 * ```
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 初期化: ローカルストレージから現在のユーザーを復元
   */
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User
        setUser(parsed)
      } catch {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
      }
    }
  }, [])

  /**
   * ユーザーをローカルストレージに保存
   */
  const saveUserToStorage = useCallback((userData: User) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userData))
  }, [])

  /**
   * ログイン処理
   *
   * バックエンドのメンバー一覧から名前でユーザーを検索し、
   * 見つかった場合はセッションを開始します。
   */
  const login = useCallback(
    async (name: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        // バックエンドからメンバー一覧を取得
        const response = await getMembers()

        // 名前でメンバーを検索
        const foundMember = response.members.find(
          (m) => m.name.toLowerCase() === name.toLowerCase()
        )

        if (foundMember) {
          const userData: User = {
            id: foundMember.id,
            name: foundMember.name,
            role: foundMember.familyRole,
            createdAt: new Date().toISOString(),
          }

          setUser(userData)
          saveUserToStorage(userData)
          return true
        }

        setError('ユーザーが見つかりませんでした')
        return false
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('ログインに失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    [saveUserToStorage]
  )

  /**
   * 新規登録処理
   *
   * バックエンドに新しいメンバーを作成し、
   * 成功した場合は自動的にログイン状態にします。
   */
  const register = useCallback(
    async (name: string, role: FamilyRole): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        // バックエンドにメンバーを作成
        const response = await createMember({
          name,
          familyRole: role,
        })

        // 作成成功後、自動ログイン
        const userData: User = {
          id: response.id,
          name: response.name,
          role: response.familyRole,
          createdAt: new Date().toISOString(),
        }

        setUser(userData)
        saveUserToStorage(userData)
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          // 名前重複エラーなどをユーザーにわかりやすく表示
          if (err.message.includes('already exists')) {
            setError('この名前は既に使用されています')
          } else {
            setError(err.message)
          }
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('登録に失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    [saveUserToStorage]
  )

  /**
   * ログアウト処理
   */
  const logout = useCallback(() => {
    setUser(null)
    setError(null)
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
  }, [])

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        error,
        login,
        logout,
        register,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * 認証フック
 *
 * AuthProviderの子コンポーネントでのみ使用可能です。
 *
 * @throws AuthProvider外で使用された場合
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, login, logout, register } = useAuth()
 *
 *   const handleLogin = async () => {
 *     const success = await login('タロウ')
 *     if (success) {
 *       console.log('ログイン成功')
 *     }
 *   }
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
