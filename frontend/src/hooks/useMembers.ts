/**
 * メンバー管理カスタムフック
 *
 * メンバーの取得・作成・更新機能を提供
 */

import { useState, useCallback, useEffect } from 'react'
import { getMembers, createMember, updateMember, ApiError } from '../api'
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
   * メンバー一覧をAPIから取得
   */
  fetchMembers: () => Promise<void>
  /**
   * メンバーを追加（ローカル状態 + API）
   */
  addMember: (name: string, email: string, familyRole: FamilyRole, password: string) => Promise<boolean>
  /**
   * メンバーを更新（ローカル状態 + API）
   */
  editMember: (id: string, name: string, familyRole: FamilyRole) => Promise<boolean>
  /**
   * メンバー一覧をセット（手動データ設定用）
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
export function useMembers(initialMembers: Member[] = []): UseMemberReturn {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * メンバー一覧をAPIから取得
   */
  const fetchMembers = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await getMembers()

      const fetchedMembers: Member[] = response.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.familyRole,
        todayEarnedPoint: m.todayEarnedPoint,
        todayFamilyTaskCompleted: m.todayFamilyTaskCompleted,
        todayPersonalTaskCompleted: m.todayPersonalTaskCompleted,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

      setMembers(fetchedMembers)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('メンバーの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * メンバーを追加
   */
  const addMember = useCallback(
    async (name: string, email: string, familyRole: FamilyRole, password: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const request: CreateMemberRequest = { name, email, familyRole, password }
        const response = await createMember(request)

        // APIレスポンスから新しいメンバーを作成
        const newMember: Member = {
          id: response.id,
          name: response.name,
          email: response.email,
          role: response.familyRole,
          todayEarnedPoint: 0,
          todayFamilyTaskCompleted: 0,
          todayPersonalTaskCompleted: 0,
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
    fetchMembers,
    addMember,
    editMember,
    setMembers,
    clearError,
  }
}

