/**
 * タスク実行管理カスタムフック
 *
 * タスク実行の取得・状態遷移・担当者割り当て機能を提供
 * @see docs/TASK_EXECUTION_API.md
 */

import { useState, useCallback } from 'react'
import {
  getTaskExecutions,
  getTaskExecution,
  startTaskExecution,
  completeTaskExecution,
  cancelTaskExecution,
  assignTaskExecution,
  generateTaskExecutions,
  ApiError,
} from '../api'
import type { GetTaskExecutionsOptions } from '../api'
import type { TaskExecution, ExecutionStatus } from '../types'
import type { TaskExecutionResponse } from '../types/api'

/**
 * タスク実行操作の状態
 */
interface UseTaskExecutionState {
  /** タスク実行一覧 */
  taskExecutions: TaskExecution[]
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}

/**
 * タスク実行操作のアクション
 */
interface UseTaskExecutionActions {
  /**
   * タスク実行一覧をAPIから取得
   * @param options - フィルタオプション（日付、ステータス、担当者など）
   */
  fetchTaskExecutions: (options?: GetTaskExecutionsOptions) => Promise<void>

  /**
   * 単一タスク実行を取得してローカル状態を更新
   * @param taskExecutionId - タスク実行ID
   */
  refreshTaskExecution: (taskExecutionId: string) => Promise<void>

  /**
   * タスクを開始（NOT_STARTED -> IN_PROGRESS）
   * @param taskExecutionId - タスク実行ID
   * @param memberId - 実行者のメンバーID
   * @returns 成功したかどうか
   */
  startTask: (taskExecutionId: string, memberId: string) => Promise<boolean>

  /**
   * タスクを完了（IN_PROGRESS -> COMPLETED）
   * @param taskExecutionId - タスク実行ID
   * @param memberId - 完了者のメンバーID
   * @returns 成功したかどうか
   */
  completeTask: (taskExecutionId: string, memberId: string) => Promise<boolean>

  /**
   * タスクをキャンセル（NOT_STARTED/IN_PROGRESS -> CANCELLED）
   * @param taskExecutionId - タスク実行ID
   * @returns 成功したかどうか
   */
  cancelTask: (taskExecutionId: string) => Promise<boolean>

  /**
   * タスクに担当者を割り当て
   * @param taskExecutionId - タスク実行ID
   * @param memberId - 担当者のメンバーID
   * @returns 成功したかどうか
   */
  assignTask: (taskExecutionId: string, memberId: string) => Promise<boolean>

  /**
   * 指定日のタスク実行を一括生成
   * @param targetDate - 対象日（YYYY-MM-DD）
   * @returns 成功したかどうか
   */
  generateTasks: (targetDate: string) => Promise<boolean>

  /**
   * タスク実行一覧を手動設定
   */
  setTaskExecutions: (taskExecutions: TaskExecution[]) => void

  /**
   * エラーをクリア
   */
  clearError: () => void
}

/**
 * フックの戻り値型
 */
type UseTaskExecutionReturn = UseTaskExecutionState & UseTaskExecutionActions

/**
 * APIレスポンスをフロントエンドの型に変換
 */
function responseToTaskExecution(response: TaskExecutionResponse): TaskExecution {
  return {
    id: response.id,
    taskDefinitionId: response.taskDefinitionId,
    assigneeMemberId: response.assigneeMemberId ?? undefined,
    scheduledDate: response.scheduledDate,
    status: response.status as ExecutionStatus,
    taskSnapshot: response.taskSnapshot
      ? {
          name: response.taskSnapshot.name,
          description: response.taskSnapshot.description ?? undefined,
          estimatedMinutes: response.taskSnapshot.estimatedMinutes,
          definitionVersion: response.taskSnapshot.definitionVersion,
          createdAt: response.taskSnapshot.createdAt,
        }
      : {
          // NOT_STARTEDの場合はtaskSnapshotがnullだが、
          // フロントエンドの型では必須なのでプレースホルダーを設定
          // 実際のUI表示では、NOT_STARTED状態では別の表示を行う
          name: '',
          estimatedMinutes: 0,
          definitionVersion: 0,
          createdAt: '',
        },
    startedAt: response.startedAt ?? undefined,
    completedAt: response.completedAt ?? undefined,
    completedByMemberId: response.completedByMemberId ?? undefined,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  }
}

/**
 * タスク実行管理カスタムフック
 *
 * @param initialTaskExecutions - 初期タスク実行リスト
 * @returns タスク実行状態とアクション
 *
 * @example
 * ```tsx
 * const {
 *   taskExecutions,
 *   loading,
 *   error,
 *   fetchTaskExecutions,
 *   startTask,
 *   completeTask,
 * } = useTaskExecution()
 *
 * // 今日のタスクを取得
 * useEffect(() => {
 *   fetchTaskExecutions({ date: '2024-12-27' })
 * }, [fetchTaskExecutions])
 *
 * // タスクを開始
 * const handleStart = async (taskId: string) => {
 *   await startTask(taskId, currentUser.id)
 * }
 * ```
 */
export function useTaskExecution(
  initialTaskExecutions: TaskExecution[] = []
): UseTaskExecutionReturn {
  const [taskExecutions, setTaskExecutions] = useState<TaskExecution[]>(
    initialTaskExecutions
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * エラーハンドリング共通処理
   */
  const handleError = useCallback((err: unknown, defaultMessage: string) => {
    if (err instanceof ApiError) {
      setError(err.message)
    } else if (err instanceof Error) {
      setError(err.message)
    } else {
      setError(defaultMessage)
    }
  }, [])

  /**
   * タスク実行一覧を取得
   */
  const fetchTaskExecutions = useCallback(
    async (options?: GetTaskExecutionsOptions): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const response = await getTaskExecutions(options)
        const taskExecs = response.taskExecutions.map(responseToTaskExecution)
        setTaskExecutions(taskExecs)
      } catch (err) {
        handleError(err, 'タスク実行の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    },
    [handleError]
  )

  /**
   * 単一タスク実行を取得して状態を更新
   */
  const refreshTaskExecution = useCallback(
    async (taskExecutionId: string): Promise<void> => {
      try {
        const response = await getTaskExecution(taskExecutionId)
        const updated = responseToTaskExecution(response)

        setTaskExecutions((prev) =>
          prev.map((task) => (task.id === taskExecutionId ? updated : task))
        )
      } catch (err) {
        handleError(err, 'タスク実行の更新に失敗しました')
      }
    },
    [handleError]
  )

  /**
   * ローカル状態を更新する共通関数
   */
  const updateLocalState = useCallback(
    (response: TaskExecutionResponse) => {
      const updated = responseToTaskExecution(response)
      setTaskExecutions((prev) =>
        prev.map((task) => (task.id === updated.id ? updated : task))
      )
    },
    []
  )

  /**
   * タスクを開始
   */
  const startTask = useCallback(
    async (taskExecutionId: string, memberId: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await startTaskExecution(taskExecutionId, { memberId })
        updateLocalState(response)
        return true
      } catch (err) {
        handleError(err, 'タスクの開始に失敗しました')
        return false
      } finally {
        setLoading(false)
      }
    },
    [handleError, updateLocalState]
  )

  /**
   * タスクを完了
   */
  const completeTask = useCallback(
    async (taskExecutionId: string, memberId: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await completeTaskExecution(taskExecutionId, { memberId })
        updateLocalState(response)
        return true
      } catch (err) {
        handleError(err, 'タスクの完了に失敗しました')
        return false
      } finally {
        setLoading(false)
      }
    },
    [handleError, updateLocalState]
  )

  /**
   * タスクをキャンセル
   */
  const cancelTask = useCallback(
    async (taskExecutionId: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await cancelTaskExecution(taskExecutionId)
        updateLocalState(response)
        return true
      } catch (err) {
        handleError(err, 'タスクのキャンセルに失敗しました')
        return false
      } finally {
        setLoading(false)
      }
    },
    [handleError, updateLocalState]
  )

  /**
   * タスクに担当者を割り当て
   */
  const assignTask = useCallback(
    async (taskExecutionId: string, memberId: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await assignTaskExecution(taskExecutionId, { memberId })
        updateLocalState(response)
        return true
      } catch (err) {
        handleError(err, '担当者の割り当てに失敗しました')
        return false
      } finally {
        setLoading(false)
      }
    },
    [handleError, updateLocalState]
  )

  /**
   * タスク実行を一括生成
   *
   * @note バックエンドは生成されたTaskExecutionのIDのみを返します。
   *       生成後にタスク一覧を最新化したい場合は、別途fetchTaskExecutionsを呼び出してください。
   * @see docs/BACKEND_ISSUES.md - 4. APIエンドポイントの命名不整合
   */
  const generateTasks = useCallback(
    async (targetDate: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await generateTaskExecutions(targetDate)

        // バックエンドはIDのみを返すため、生成成功をログに記録
        console.log(
          `${response.generatedCount}件のタスクを生成しました (${response.targetDate})`
        )

        // 生成されたタスクをリストに追加する場合は、fetchTaskExecutionsで再取得が必要
        // ここでは生成成功のみを返す
        return true
      } catch (err) {
        handleError(err, 'タスクの生成に失敗しました')
        return false
      } finally {
        setLoading(false)
      }
    },
    [handleError]
  )

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    taskExecutions,
    loading,
    error,
    fetchTaskExecutions,
    refreshTaskExecution,
    startTask,
    completeTask,
    cancelTask,
    assignTask,
    generateTasks,
    setTaskExecutions,
    clearError,
  }
}

