/**
 * ダッシュボードカスタムフック
 *
 * CQRSパターン: ダッシュボード画面に必要なデータを一括取得
 * - 今日のタスク一覧
 * - メンバーごとのタスクサマリー
 * - メンバーの空き時間
 */

import { useState, useCallback, useEffect } from 'react'
import { getDashboardData, ApiError } from '../api'
import { startTaskExecution, completeTaskExecution, assignTaskExecution } from '../api'
import type {
  DashboardResponse,
  TodayTaskDto,
  MemberTaskSummaryDto,
  MemberAvailabilityTodayDto,
} from '../api/dashboard'

/**
 * ダッシュボードの状態
 */
interface UseDashboardState {
  /** 今日のタスク一覧 */
  todayTasks: TodayTaskDto[]
  /** メンバーごとのタスクサマリー */
  memberSummaries: MemberTaskSummaryDto[]
  /** メンバーの空き時間 */
  memberAvailabilities: MemberAvailabilityTodayDto[]
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}

/**
 * ダッシュボードのアクション
 */
interface UseDashboardActions {
  /**
   * ダッシュボードデータを再取得
   */
  refetch: () => Promise<void>
  /**
   * タスクを開始する
   * @param taskExecutionId - タスク実行ID
   */
  startTask: (taskExecutionId: string) => Promise<boolean>
  /**
   * タスクを完了する
   * @param taskExecutionId - タスク実行ID
   * @param completedByMemberId - 完了者のメンバーID
   */
  completeTask: (taskExecutionId: string, completedByMemberId: string) => Promise<boolean>
  /**
   * タスクの担当者を割り当てる
   * @param taskExecutionId - タスク実行ID
   * @param assigneeMemberId - 担当者のメンバーID
   */
  assignTask: (taskExecutionId: string, assigneeMemberId: string) => Promise<boolean>
  /**
   * エラーをクリア
   */
  clearError: () => void
}

type UseDashboardReturn = UseDashboardState & UseDashboardActions

/**
 * ダッシュボードカスタムフック
 *
 * @param date - 対象日（YYYY-MM-DD形式）、省略時は今日
 * @returns ダッシュボードの状態とアクション
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const {
 *     todayTasks,
 *     memberSummaries,
 *     memberAvailabilities,
 *     loading,
 *     error,
 *     startTask,
 *     completeTask,
 *     refetch,
 *   } = useDashboard()
 *
 *   if (loading) return <Loading />
 *   if (error) return <Error message={error} />
 *
 *   return (
 *     <>
 *       <TaskList tasks={todayTasks} onStart={startTask} />
 *       <MemberProgress summaries={memberSummaries} />
 *       <MemberAvailability availabilities={memberAvailabilities} />
 *     </>
 *   )
 * }
 * ```
 */
export function useDashboard(date?: string): UseDashboardReturn {
  const [state, setState] = useState<UseDashboardState>({
    todayTasks: [],
    memberSummaries: [],
    memberAvailabilities: [],
    loading: true,
    error: null,
  })

  /**
   * ダッシュボードデータを取得
   */
  const fetchDashboardData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data: DashboardResponse = await getDashboardData(date)
      setState({
        todayTasks: data.todayTasks,
        memberSummaries: data.memberSummaries,
        memberAvailabilities: data.memberAvailabilities,
        loading: false,
        error: null,
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'ダッシュボードデータの取得に失敗しました'
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }))
    }
  }, [date])

  /**
   * タスクを開始する
   * @note バックエンドのstartTaskExecutionはmemberIdが必要ですが、
   *       空文字で渡してバックエンド側で処理します
   */
  const startTask = useCallback(
    async (taskExecutionId: string): Promise<boolean> => {
      try {
        // NOTE: バックエンドは開始時にmemberIdを必要としますが、
        // UIでは簡略化のため引数なしで呼び出し可能にしています
        await startTaskExecution(taskExecutionId, { memberId: '' })
        // 成功後にデータを再取得
        await fetchDashboardData()
        return true
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'タスクの開始に失敗しました'
        setState((prev) => ({ ...prev, error: message }))
        return false
      }
    },
    [fetchDashboardData]
  )

  /**
   * タスクを完了する
   */
  const completeTask = useCallback(
    async (taskExecutionId: string, completedByMemberId: string): Promise<boolean> => {
      try {
        await completeTaskExecution(taskExecutionId, { memberId: completedByMemberId })
        // 成功後にデータを再取得
        await fetchDashboardData()
        return true
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'タスクの完了に失敗しました'
        setState((prev) => ({ ...prev, error: message }))
        return false
      }
    },
    [fetchDashboardData]
  )

  /**
   * タスクの担当者を割り当てる
   */
  const assignTask = useCallback(
    async (taskExecutionId: string, assigneeMemberId: string): Promise<boolean> => {
      try {
        await assignTaskExecution(taskExecutionId, { memberId: assigneeMemberId })
        // 成功後にデータを再取得
        await fetchDashboardData()
        return true
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'タスクの担当者設定に失敗しました'
        setState((prev) => ({ ...prev, error: message }))
        return false
      }
    },
    [fetchDashboardData]
  )

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  // 初回ロード
  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  return {
    ...state,
    refetch: fetchDashboardData,
    startTask,
    completeTask,
    assignTask,
    clearError,
  }
}

export default useDashboard

