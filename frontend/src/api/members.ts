/**
 * Member API関数
 *
 * メンバー関連のAPI呼び出しを提供
 * @see backend/src/main/kotlin/com/task/presentation/Members.kt
 */

import { apiGet, apiPost } from './client'
import type {
  CreateMemberRequest,
  CreateMemberResponse,
  UpdateMemberRequest,
  UpdateMemberResponse,
  GetMembersResponse,
  MemberResponse,
} from '../types/api'

/**
 * メンバーを作成する
 *
 * @param request - 作成リクエスト
 * @returns 作成されたメンバー情報
 *
 * @note バックエンドのレスポンス実装後に動作確認が必要
 * @see doc/backend-issues.md - 問題1: レスポンス未返却
 *
 * @example
 * ```typescript
 * const member = await createMember({
 *   name: 'タロウ',
 *   familyRole: 'BROTHER'
 * })
 * ```
 */
export async function createMember(
  request: CreateMemberRequest
): Promise<CreateMemberResponse> {
  return apiPost<CreateMemberResponse, CreateMemberRequest>(
    '/member/create',
    request
  )
}

/**
 * メンバーを更新する
 *
 * @param memberId - 更新対象のメンバーID
 * @param request - 更新リクエスト
 * @returns 更新されたメンバー情報
 *
 * @note バックエンドのレスポンス実装後に動作確認が必要
 * @see doc/backend-issues.md - 問題1: レスポンス未返却
 *
 * @example
 * ```typescript
 * const member = await updateMember('uuid', {
 *   name: '新しい名前',
 *   familyRole: 'SISTER'
 * })
 * ```
 */
export async function updateMember(
  memberId: string,
  request: UpdateMemberRequest
): Promise<UpdateMemberResponse> {
  return apiPost<UpdateMemberResponse, UpdateMemberRequest>(
    `/member/${memberId}/update`,
    request
  )
}

/**
 * メンバー一覧を取得する
 * GET /api/member
 *
 * @returns メンバー一覧
 *
 * @example
 * ```typescript
 * const { members } = await getMembers()
 * ```
 */
export async function getMembers(): Promise<GetMembersResponse> {
  return apiGet<GetMembersResponse>('/member')
}

/**
 * 個別メンバーを取得する
 * GET /api/member/{memberId}
 *
 * @param memberId - 取得対象のメンバーID
 * @returns メンバー情報
 *
 * @example
 * ```typescript
 * const member = await getMember('uuid')
 * ```
 */
export async function getMember(memberId: string): Promise<MemberResponse> {
  return apiGet<MemberResponse>(`/member/${memberId}`)
}

