/**
 * メンバー空き時間管理カスタムフック
 *
 * 空き時間の取得・作成・更新・削除機能を提供
 */

import { useState, useCallback } from 'react'
import {
  createMemberAvailability,
  updateMemberAvailability,
  deleteMemberAvailabilitySlots,
  ApiError,
} from '../api'
import type {
  CreateMemberAvailabilityRequest,
  UpdateMemberAvailabilityRequest,
  DeleteMemberAvailabilitySlotsRequest,
  TimeSlotRequest,
} from '../types/api'

/**
 * 空き時間データ（フロントエンド用）
 */
export interface MemberAvailability {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlot[]
}

/**
 * 時間スロット（フロントエンド用）
 */
export interface TimeSlot {
  startTime: string
  endTime: string
  memo?: string | null
}

/**
 * 空き時間操作の状態
 */
interface UseMemberAvailabilityState {
  /** 空き時間一覧 */
  availabilities: MemberAvailability[]
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}

/**
 * 空き時間操作のアクション
 */
interface UseMemberAvailabilityActions {
  /**
   * 空き時間を作成
   */
  addAvailability: (
    memberId: string,
    targetDate: string,
    slots: TimeSlotRequest[]
  ) => Promise<boolean>
  /**
   * 空き時間を更新（スロット全体置換）
   */
  editAvailability: (
    availabilityId: string,
    slots: TimeSlotRequest[]
  ) => Promise<boolean>
  /**
   * 空き時間スロットを削除
   */
  removeSlots: (
    availabilityId: string,
    slots: TimeSlotRequest[]
  ) => Promise<boolean>
  /**
   * 空き時間一覧をセット（初期データ設定用）
   */
  setAvailabilities: (availabilities: MemberAvailability[]) => void
  /**
   * エラーをクリア
   */
  clearError: () => void
}

/**
 * 空き時間管理フックの戻り値
 */
type UseMemberAvailabilityReturn = UseMemberAvailabilityState & UseMemberAvailabilityActions

/**
 * メンバー空き時間管理カスタムフック
 *
 * @param initialAvailabilities - 初期空き時間リスト
 * @returns 空き時間状態とアクション
 *
 * @example
 * ```tsx
 * const { availabilities, loading, error, addAvailability } = useMemberAvailability()
 *
 * const handleAdd = async () => {
 *   const success = await addAvailability('memberId', '2024-01-01', [
 *     { startTime: '10:00', endTime: '12:00', memo: 'メモ' }
 *   ])
 * }
 * ```
 */
export function useMemberAvailability(
  initialAvailabilities: MemberAvailability[] = []
): UseMemberAvailabilityReturn {
  const [availabilities, setAvailabilities] = useState<MemberAvailability[]>(
    initialAvailabilities
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 空き時間を作成
   */
  const addAvailability = useCallback(
    async (
      memberId: string,
      targetDate: string,
      slots: TimeSlotRequest[]
    ): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const request: CreateMemberAvailabilityRequest = {
          memberId,
          targetDate,
          slots,
        }
        const response = await createMemberAvailability(request)

        // APIレスポンスから新しい空き時間を作成
        const newAvailability: MemberAvailability = {
          id: response.id,
          memberId: response.memberId,
          targetDate: response.targetDate,
          slots: response.slots.map((slot) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            memo: slot.memo,
          })),
        }

        setAvailabilities((prev) => [...prev, newAvailability])
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('空き時間の登録に失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * 空き時間を更新
   */
  const editAvailability = useCallback(
    async (availabilityId: string, slots: TimeSlotRequest[]): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const request: UpdateMemberAvailabilityRequest = { slots }
        const response = await updateMemberAvailability(availabilityId, request)

        // ローカル状態を更新
        setAvailabilities((prev) =>
          prev.map((availability) =>
            availability.id === availabilityId
              ? {
                  ...availability,
                  slots: response.slots.map((slot) => ({
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    memo: slot.memo,
                  })),
                }
              : availability
          )
        )
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('空き時間の更新に失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * 空き時間スロットを削除
   */
  const removeSlots = useCallback(
    async (availabilityId: string, slots: TimeSlotRequest[]): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const request: DeleteMemberAvailabilitySlotsRequest = { slots }
        const response = await deleteMemberAvailabilitySlots(availabilityId, request)

        // ローカル状態を更新
        setAvailabilities((prev) =>
          prev.map((availability) =>
            availability.id === availabilityId
              ? {
                  ...availability,
                  slots: response.slots.map((slot) => ({
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    memo: slot.memo,
                  })),
                }
              : availability
          )
        )
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('スロットの削除に失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    availabilities,
    loading,
    error,
    addAvailability,
    editAvailability,
    removeSlots,
    setAvailabilities,
    clearError,
  }
}

