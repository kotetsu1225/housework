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
  SESSION_EXPIRY: 'housework_sessionExpiry',
} as const

/** セッション有効期限（7日間） */
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 認証コンテキストの型定義
 */
interface AuthContextType {
  /** 現在のユーザー */
  user: User | null
  /** 認証状態 */
  isAuthenticated: boolean
  /** 初期化中（セッション復元中） */
  isInitializing: boolean
  /** ローディング状態（認証操作中） */
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
  const [isInitializing, setIsInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * セッション有効期限をチェック
   */
  const isSessionValid = useCallback((): boolean => {
    const expiryStr = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY)
    if (!expiryStr) return false

    const expiry = parseInt(expiryStr, 10)
    return Date.now() < expiry
  }, [])

  /**
   * セッション有効期限を設定
   */
  const setSessionExpiry = useCallback(() => {
    const expiry = Date.now() + SESSION_EXPIRY_MS
    localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, expiry.toString())
  }, [])

  /**
   * セッションをクリア
   */
  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
    localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY)
  }, [])

  /**
   * 初期化: ローカルストレージから現在のユーザーを復元
   */
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
    if (storedUser && isSessionValid()) {
      try {
        const parsed = JSON.parse(storedUser) as User
        setUser(parsed)
        // セッションを延長
        setSessionExpiry()
      } catch {
        clearSession()
      }
    } else if (storedUser) {
      // セッション期限切れの場合はクリア
      clearSession()
    }
    setIsInitializing(false)
  }, [isSessionValid, setSessionExpiry, clearSession])

  /**
   * ユーザーをローカルストレージに保存（セッション有効期限も設定）
   */
  const saveUserToStorage = useCallback((userData: User) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userData))
    setSessionExpiry()
  }, [setSessionExpiry])

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
    clearSession()
  }, [clearSession])

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
        isInitializing,
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
