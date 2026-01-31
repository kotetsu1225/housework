/**
 * 完了タスク管理カスタムフック
 *
 * 完了済みタスクの取得機能を提供
 */

import { useState, useCallback } from 'react'
import {
  getCompletedTasks,
  type GetCompletedTasksOptions,
  type CompletedTaskDto,
} from '../api/completedTasks'
import { ApiError } from '../api/client'

/**
 * フックの状態
 */
interface UseCompletedTasksState {
  /** 完了タスク一覧 */
  completedTasks: CompletedTaskDto[]
  /** 次のページがあるか */
  hasMore: boolean
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}

/**
 * フックのアクション
 */
interface UseCompletedTasksActions {
  /**
   * 完了タスク一覧を取得
   * @param options - フィルタオプション
   */
  fetchCompletedTasks: (options?: GetCompletedTasksOptions) => Promise<void>

  /**
   * 追加読み込み（ページネーション）
   * @param options - フィルタオプション（offsetは自動計算）
   */
  loadMore: (options?: Omit<GetCompletedTasksOptions, 'offset'>) => Promise<void>

  /**
   * エラーをクリア
   */
  clearError: () => void
}

/**
 * フックの戻り値型
 */
type UseCompletedTasksReturn = UseCompletedTasksState & UseCompletedTasksActions

/**
 * 完了タスク管理カスタムフック
 *
 * @returns 完了タスク状態とアクション
 *
 * @example
 * ```tsx
 * const {
 *   completedTasks,
 *   hasMore,
 *   loading,
 *   error,
 *   fetchCompletedTasks,
 *   loadMore,
 * } = useCompletedTasks()
 *
 * // 今日の完了タスクを取得
 * useEffect(() => {
 *   fetchCompletedTasks({ date: '2025-01-31' })
 * }, [fetchCompletedTasks])
 *
 * // 追加読み込み
 * const handleLoadMore = () => {
 *   loadMore({ date: '2025-01-31' })
 * }
 * ```
 */
export function useCompletedTasks(): UseCompletedTasksReturn {
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskDto[]>([])
  const [hasMore, setHasMore] = useState(false)
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
   * 完了タスク一覧を取得
   */
  const fetchCompletedTasks = useCallback(
    async (options?: GetCompletedTasksOptions): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const response = await getCompletedTasks(options)
        setCompletedTasks(response.completedTasks)
        setHasMore(response.hasMore)
      } catch (err) {
        handleError(err, '完了タスクの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    },
    [handleError]
  )

  /**
   * 追加読み込み（ページネーション）
   */
  const loadMore = useCallback(
    async (options?: Omit<GetCompletedTasksOptions, 'offset'>): Promise<void> => {
      if (loading || !hasMore) return

      setLoading(true)
      setError(null)

      try {
        const response = await getCompletedTasks({
          ...options,
          offset: completedTasks.length,
        })
        setCompletedTasks((prev) => [...prev, ...response.completedTasks])
        setHasMore(response.hasMore)
      } catch (err) {
        handleError(err, '追加読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    },
    [completedTasks.length, handleError, hasMore, loading]
  )

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    completedTasks,
    hasMore,
    loading,
    error,
    fetchCompletedTasks,
    loadMore,
    clearError,
  }
}
