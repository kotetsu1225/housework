/**
 * 共通APIクライアント
 *
 * fetch APIのラッパーで、型安全なAPI呼び出しを提供
 * エラーハンドリングとJSON変換を統一的に処理
 * JWT認証トークンの自動付与機能を含む
 */

import type { ApiErrorResponse } from '../types/api'

const API_BASE = '/api'

/** JWTトークン保存用のローカルストレージキー */
export const TOKEN_STORAGE_KEY = 'housework_token'

/**
 * JWTトークンを取得する
 * @returns 保存されているトークン、または null
 */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

/**
 * JWTトークンを保存する
 * @param token - 保存するJWTトークン
 */
export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

/**
 * JWTトークンを削除する
 */
export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

/**
 * APIエラークラス
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: ApiErrorResponse
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /**
   * 認証エラー（401）かどうかを判定
   */
  get isUnauthorized(): boolean {
    return this.status === 401
  }
}

/**
 * APIクライアントのオプション
 */
interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/**
 * 型安全なAPIクライアント
 *
 * @param endpoint - APIエンドポイント（/api は自動付与）
 * @param options - fetchオプション（bodyは自動でJSON文字列化）
 * @returns APIレスポンス
 * @throws {ApiError} APIエラー時
 *
 * @example
 * ```typescript
 * // GETリクエスト
 * const members = await apiClient<GetMembersResponse>('/member')
 *
 * // POSTリクエスト
 * const result = await apiClient<CreateMemberResponse>('/member/create', {
 *   method: 'POST',
 *   body: { name: 'タロウ', familyRole: 'BROTHER' }
 * })
 * ```
 */
export async function apiClient<T>(
  endpoint: string,
  options?: ApiClientOptions
): Promise<T> {
  const { body, headers, ...restOptions } = options || {}

  // JWTトークンをヘッダーに追加（認証エンドポイント以外）
  const authHeaders: Record<string, string> = {}
  const isAuthEndpoint = endpoint.startsWith('/auth/')
  if (!isAuthEndpoint) {
    const token = getStoredToken()
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...restOptions,
  })

  // レスポンスボディがない場合（204 No Content等）
  const contentType = response.headers.get('content-type')
  const hasJsonBody = contentType?.includes('application/json')

  if (!response.ok) {
    let errorData: ApiErrorResponse | undefined
    if (hasJsonBody) {
      try {
        errorData = await response.json()
      } catch {
        // JSONパース失敗時は無視
      }
    }

    // 401エラーの場合はトークンを削除（セッション無効化）
    if (response.status === 401) {
      removeStoredToken()
    }

    throw new ApiError(
      errorData?.error || `API Error: ${response.status}`,
      response.status,
      errorData
    )
  }

  // 204 No Contentの場合は空オブジェクトを返す
  if (response.status === 204 || !hasJsonBody) {
    return {} as T
  }

  return response.json()
}

/**
 * GETリクエスト用のヘルパー関数
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: 'GET' })
}

/**
 * POSTリクエスト用のヘルパー関数
 */
export async function apiPost<T, B = unknown>(
  endpoint: string,
  body: B
): Promise<T> {
  return apiClient<T>(endpoint, { method: 'POST', body })
}

/**
 * PUTリクエスト用のヘルパー関数
 */
export async function apiPut<T, B = unknown>(
  endpoint: string,
  body: B
): Promise<T> {
  return apiClient<T>(endpoint, { method: 'PUT', body })
}

/**
 * DELETEリクエスト用のヘルパー関数
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: 'DELETE' })
}

