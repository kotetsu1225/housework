/**
 * MemberAvailability API関数
 *
 * メンバー空き時間関連のAPI呼び出しを提供
 * @see backend/src/main/kotlin/com/task/presentation/MemberAvailabilities.kt
 */

import { apiDelete, apiGet, apiPost } from './client'
import type {
  CreateMemberAvailabilityRequest,
  CreateMemberAvailabilityResponse,
  UpdateMemberAvailabilityRequest,
  UpdateMemberAvailabilityResponse,
  DeleteMemberAvailabilitySlotsRequest,
  DeleteMemberAvailabilitySlotsResponse,
  GetMemberAvailabilitiesResponse,
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
 * GET /api/member-availabilities/member/{memberId}
 *
 * @param memberId - メンバーID
 * @returns 空き時間一覧
 *
 * @example
 * ```typescript
 * const { availabilities } = await getMemberAvailabilities('uuid')
 * ```
 */
export async function getMemberAvailabilities(
  memberId: string
): Promise<GetMemberAvailabilitiesResponse> {
  return apiGet<GetMemberAvailabilitiesResponse>(`/member-availabilities/member/${memberId}`)
}

/**
 * 空き時間を物理削除する
 * DELETE /api/member-availabilities/{availabilityId}
 *
 * @param availabilityId - 削除対象の空き時間ID
 *
 * @note 最後のスロットを削除する場合に使用
 *       空き時間全体を削除し、関連するスロットも自動削除される
 *
 * @example
 * ```typescript
 * await deleteMemberAvailability('uuid')
 * ```
 */
export async function deleteMemberAvailability(
  availabilityId: string
): Promise<void> {
  await apiDelete<void>(`/member-availabilities/${availabilityId}`)
}

