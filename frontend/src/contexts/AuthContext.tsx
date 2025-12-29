/**
 * 認証コンテキスト
 *
 * JWT認証によるメンバー認証の状態管理とバックエンドAPI連携を提供
 * @see backend/src/main/kotlin/com/task/presentation/Auth.kt
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import {
  loginApi,
  registerApi,
  ApiError,
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  getMember,
} from '../api'
import type { User, FamilyRole } from '../types'

/** ローカルストレージのキー */
const STORAGE_KEYS = {
  CURRENT_USER: 'housework_currentUser',
} as const

/**
 * JWTトークンからペイロードをデコードする
 * @param token - JWTトークン
 * @returns デコードされたペイロード
 */
function decodeJwtPayload(token: string): {
  sub: string // memberId
  name: string
  role: string
  exp: number
} | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * トークンが有効期限内かチェックする
 * @param token - JWTトークン
 * @returns 有効期限内ならtrue
 */
function isTokenValid(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload) return false
  // exp はUNIXタイムスタンプ（秒単位）
  return payload.exp * 1000 > Date.now()
}

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
   * ログイン（バックエンドの/api/auth/loginを使用）
   * @param name - メンバー名
   * @param password - パスワード
   * @returns ログイン成功したかどうか
   */
  login: (name: string, password: string) => Promise<boolean>
  /** ログアウト */
  logout: () => void
  /**
   * 新規登録（バックエンドの/api/auth/registerを使用）
   * @param name - メンバー名
   * @param role - 家族の役割
   * @param password - パスワード
   * @returns 登録成功したかどうか
   */
  register: (name: string, role: FamilyRole, password: string) => Promise<boolean>
  /** エラーをクリア */
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * 認証プロバイダー
 *
 * アプリケーション全体で認証状態を管理します。
 * バックエンドのAuth APIと連携し、JWT認証によるログイン・登録機能を提供します。
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
   * セッションをクリア（トークンとユーザー情報を削除）
   */
  const clearSession = useCallback(() => {
    removeStoredToken()
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
    setUser(null)
  }, [])

  /**
   * ユーザー情報をローカルストレージに保存
   */
  const saveUserToStorage = useCallback((userData: User) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userData))
  }, [])

  /**
   * トークンからユーザー情報を復元
   */
  const restoreUserFromToken = useCallback(async (token: string): Promise<User | null> => {
    const payload = decodeJwtPayload(token)
    if (!payload) return null

    // ローカルストレージからユーザー情報を取得
    const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
    if (storedUser) {
      try {
        return JSON.parse(storedUser) as User
      } catch {
        // パース失敗時はAPIから取得
      }
    }

    // APIからメンバー情報を取得
    try {
      const member = await getMember(payload.sub)
      return {
        id: member.id,
        name: member.name,
        role: member.familyRole,
        createdAt: new Date().toISOString(),
      }
    } catch {
      return null
    }
  }, [])

  /**
   * 初期化: 保存されたトークンから認証状態を復元
   */
  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken()

      if (token && isTokenValid(token)) {
        const userData = await restoreUserFromToken(token)
        if (userData) {
          setUser(userData)
        } else {
          // ユーザー情報の取得に失敗した場合はセッションクリア
          clearSession()
        }
      } else if (token) {
        // トークンが期限切れの場合はクリア
        clearSession()
      }

      setIsInitializing(false)
    }

    initAuth()
  }, [restoreUserFromToken, clearSession])

  /**
   * ログイン処理
   *
   * バックエンドの/api/auth/loginエンドポイントを呼び出し、
   * JWTトークンを取得してセッションを開始します。
   */
  const login = useCallback(
    async (name: string, password: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        // バックエンドにログインリクエスト
        const response = await loginApi({ name, password })

        // トークンを保存
        setStoredToken(response.token)

        // トークンからユーザー情報を取得
        const payload = decodeJwtPayload(response.token)
        if (!payload) {
          setError('トークンの解析に失敗しました')
          return false
        }

        const userData: User = {
          id: payload.sub,
          name: response.memberName,
          role: payload.role as FamilyRole,
          createdAt: new Date().toISOString(),
        }

        setUser(userData)
        saveUserToStorage(userData)
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setError('名前またはパスワードが正しくありません')
          } else {
            setError(err.message)
          }
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
   * バックエンドの/api/auth/registerエンドポイントを呼び出し、
   * メンバーを作成してJWTトークンを取得します。
   */
  const register = useCallback(
    async (name: string, role: FamilyRole, password: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        // バックエンドに登録リクエスト
        const response = await registerApi({
          name,
          familyRole: role,
          password,
        })

        // トークンを保存
        setStoredToken(response.token)

        // トークンからユーザー情報を取得
        const payload = decodeJwtPayload(response.token)
        if (!payload) {
          setError('トークンの解析に失敗しました')
          return false
        }

        const userData: User = {
          id: payload.sub,
          name: response.memberName,
          role: payload.role as FamilyRole,
          createdAt: new Date().toISOString(),
        }

        setUser(userData)
        saveUserToStorage(userData)
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          // 名前重複エラーなどをユーザーにわかりやすく表示
          if (err.message.includes('重複') || err.message.includes('already exists')) {
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
 *     const success = await login('タロウ', 'password123')
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
