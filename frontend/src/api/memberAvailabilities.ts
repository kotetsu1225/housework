/**
 * MemberAvailability API関数
 *
 * メンバー空き時間関連のAPI呼び出しを提供
 * @see backend/src/main/kotlin/com/task/presentation/MemberAvailabilities.kt
 */

import { apiPost } from './client'
import type {
  CreateMemberAvailabilityRequest,
  CreateMemberAvailabilityResponse,
  UpdateMemberAvailabilityRequest,
  UpdateMemberAvailabilityResponse,
  DeleteMemberAvailabilitySlotsRequest,
  DeleteMemberAvailabilitySlotsResponse,
} from '../types/api'

/**
 * 空き時間を作成する
 *
 * @param request - 作成リクエスト
 * @returns 作成された空き時間情報
 *
 * @example
 * ```typescript
 * const availability = await createMemberAvailability({
 *   memberId: 'uuid',
 *   targetDate: '2024-01-01',
 *   slots: [
 *     { startTime: '10:00', endTime: '12:00', memo: '買い物後' }
 *   ]
 * })
 * ```
 */
export async function createMemberAvailability(
  request: CreateMemberAvailabilityRequest
): Promise<CreateMemberAvailabilityResponse> {
  return apiPost<CreateMemberAvailabilityResponse, CreateMemberAvailabilityRequest>(
    '/member-availabilities/create',
    request
  )
}

/**
 * 空き時間を更新する（スロット全体を置換）
 *
 * @param availabilityId - 更新対象の空き時間ID
 * @param request - 更新リクエスト
 * @returns 更新された空き時間情報
 *
 * @example
 * ```typescript
 * const availability = await updateMemberAvailability('uuid', {
 *   slots: [
 *     { startTime: '14:00', endTime: '16:00' }
 *   ]
 * })
 * ```
 */
export async function updateMemberAvailability(
  availabilityId: string,
  request: UpdateMemberAvailabilityRequest
): Promise<UpdateMemberAvailabilityResponse> {
  return apiPost<UpdateMemberAvailabilityResponse, UpdateMemberAvailabilityRequest>(
    `/member-availabilities/${availabilityId}/update`,
    request
  )
}

/**
 * 空き時間スロットを削除する
 *
 * @param availabilityId - 対象の空き時間ID
 * @param request - 削除するスロット
 * @returns 更新後の空き時間情報
 *
 * @example
 * ```typescript
 * const availability = await deleteMemberAvailabilitySlots('uuid', {
 *   slots: [
 *     { startTime: '10:00', endTime: '12:00' }
 *   ]
 * })
 * ```
 */
export async function deleteMemberAvailabilitySlots(
  availabilityId: string,
  request: DeleteMemberAvailabilitySlotsRequest
): Promise<DeleteMemberAvailabilitySlotsResponse> {
  return apiPost<DeleteMemberAvailabilitySlotsResponse, DeleteMemberAvailabilitySlotsRequest>(
    `/member-availabilities/${availabilityId}/delete-slots`,
    request
  )
}

/**
 * メンバーの空き時間一覧を取得する
 *
 * @note バックエンドにGETエンドポイントが存在しないため、現在は使用不可
 * @see docs/BACKEND_ISSUES.md - 問題3: GETエンドポイントの欠如
 */
// export async function getMemberAvailabilities(
//   memberId: string
// ): Promise<MemberAvailabilityResponse[]> {
//   return apiGet<MemberAvailabilityResponse[]>(`/member-availabilities/member/${memberId}`)
// }

