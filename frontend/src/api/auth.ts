/**
 * Auth API関数
 *
 * 認証関連のAPI呼び出しを提供
 * @see backend/src/main/kotlin/com/task/presentation/Auth.kt
 */

import { apiPost } from './client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types/api'

/**
 * ログイン
 *
 * @param request - ログインリクエスト（name, password）
 * @returns JWTトークンとメンバー名
 *
 * @example
 * ```typescript
 * const { token, memberName } = await loginApi({
 *   name: 'タロウ',
 *   password: 'password123'
 * })
 * ```
 */
export async function loginApi(
  request: LoginRequest
): Promise<LoginResponse> {
  return apiPost<LoginResponse, LoginRequest>('/auth/login', request)
}

/**
 * 新規登録
 *
 * @param request - 登録リクエスト（name, familyRole, password）
 * @returns JWTトークンとメンバー名
 *
 * @example
 * ```typescript
 * const { token, memberName } = await registerApi({
 *   name: 'タロウ',
 *   familyRole: 'BROTHER',
 *   password: 'password123'
 * })
 * ```
 */
export async function registerApi(
  request: RegisterRequest
): Promise<RegisterResponse> {
  return apiPost<RegisterResponse, RegisterRequest>('/auth/register', request)
}

