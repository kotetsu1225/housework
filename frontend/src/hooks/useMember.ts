/**
 * メンバー管理カスタムフック
 *
 * メンバーの取得・作成・更新機能を提供
 */

import { useState, useCallback } from 'react'
import { createMember, updateMember, ApiError } from '../api'
import type { Member, FamilyRole } from '../types'
import type { CreateMemberRequest, UpdateMemberRequest } from '../types/api'

/**
 * メンバー操作の状態
 */
interface UseMemberState {
  /** メンバー一覧 */
  members: Member[]
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}

/**
 * メンバー操作のアクション
 */
interface UseMemberActions {
  /**
   * メンバーを追加（ローカル状態 + API）
   * @note バックエンド修正後、APIレスポンスからidを取得するよう更新が必要
   */
  addMember: (name: string, familyRole: FamilyRole) => Promise<boolean>
  /**
   * メンバーを更新（ローカル状態 + API）
   */
  editMember: (id: string, name: string, familyRole: FamilyRole) => Promise<boolean>
  /**
   * メンバー一覧をセット（初期データ設定用）
   */
  setMembers: (members: Member[]) => void
  /**
   * エラーをクリア
   */
  clearError: () => void
}

/**
 * メンバー管理フックの戻り値
 */
type UseMemberReturn = UseMemberState & UseMemberActions

/**
 * メンバー管理カスタムフック
 *
 * @param initialMembers - 初期メンバーリスト
 * @returns メンバー状態とアクション
 *
 * @example
 * ```tsx
 * const { members, loading, error, addMember, editMember } = useMember(initialMembers)
 *
 * const handleAdd = async () => {
 *   const success = await addMember('タロウ', 'BROTHER')
 *   if (success) {
 *     console.log('追加成功')
 *   }
 * }
 * ```
 */
export function useMember(initialMembers: Member[] = []): UseMemberReturn {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * メンバーを追加
   */
  const addMember = useCallback(
    async (name: string, familyRole: FamilyRole): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const request: CreateMemberRequest = { name, familyRole }
        const response = await createMember(request)

        // APIレスポンスから新しいメンバーを作成
        const newMember: Member = {
          id: response.id,
          name: response.name,
          role: response.familyRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setMembers((prev) => [...prev, newMember])
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('メンバーの追加に失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * メンバーを更新
   */
  const editMember = useCallback(
    async (id: string, name: string, familyRole: FamilyRole): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const request: UpdateMemberRequest = { name, familyRole }
        const response = await updateMember(id, request)

        // ローカル状態を更新
        setMembers((prev) =>
          prev.map((member) =>
            member.id === id
              ? {
                  ...member,
                  name: response.name,
                  role: response.familyRole,
                  updatedAt: new Date().toISOString(),
                }
              : member
          )
        )
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('メンバーの更新に失敗しました')
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
    members,
    loading,
    error,
    addMember,
    editMember,
    setMembers,
    clearError,
  }
}

