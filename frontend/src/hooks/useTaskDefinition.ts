/**
 * タスク定義管理カスタムフック
 *
 * タスク定義の取得・作成・更新・削除機能を提供
 */

import { useState, useCallback } from 'react'
import {
  getTaskDefinitions,
  createTaskDefinition,
  updateTaskDefinition,
  deleteTaskDefinition,
  ApiError,
} from '../api'
import type { TaskDefinition } from '../types'
import type {
  CreateTaskDefinitionRequest,
  UpdateTaskDefinitionRequest,
  ScheduleDto,
} from '../types/api'

/**
 * タスク定義操作の状態
 */
interface UseTaskDefinitionState {
  /** タスク定義一覧 */
  taskDefinitions: TaskDefinition[]
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}

/**
 * タスク定義操作のアクション
 */
interface UseTaskDefinitionActions {
  /**
   * タスク定義一覧をAPIから取得
   */
  fetchTaskDefinitions: (limit?: number, offset?: number) => Promise<void>
  /**
   * タスク定義を追加（ローカル状態 + API）
   */
  addTaskDefinition: (request: CreateTaskDefinitionRequest) => Promise<boolean>
  /**
   * タスク定義を更新（ローカル状態 + API）
   */
  editTaskDefinition: (
    id: string,
    request: UpdateTaskDefinitionRequest
  ) => Promise<boolean>
  /**
   * タスク定義を削除（ローカル状態 + API）
   */
  removeTaskDefinition: (id: string) => Promise<boolean>
  /**
   * タスク定義一覧をセット（手動データ設定用）
   */
  setTaskDefinitions: (taskDefinitions: TaskDefinition[]) => void
  /**
   * エラーをクリア
   */
  clearError: () => void
}

/**
 * タスク定義管理フックの戻り値
 */
type UseTaskDefinitionReturn = UseTaskDefinitionState & UseTaskDefinitionActions

/**
 * ScheduleDtoをTaskDefinitionのスケジュール形式に変換
 */
function scheduleDtoToTaskDefinition(
  dto: ScheduleDto
): Pick<TaskDefinition, 'scheduleType' | 'oneTimeDeadline' | 'recurrence'> {
  if (dto.type === 'OneTime') {
    return {
      scheduleType: 'ONE_TIME',
      oneTimeDeadline: dto.deadline,
      recurrence: undefined,
    }
  }

  // Recurring
  const patternType = dto.pattern.type
  return {
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: patternType as 'DAILY' | 'WEEKLY' | 'MONTHLY',
      dailySkipWeekends:
        dto.pattern.type === 'Daily' ? dto.pattern.skipWeekends : undefined,
      weeklyDayOfWeek:
        dto.pattern.type === 'Weekly'
          ? dayOfWeekToNumber(dto.pattern.dayOfWeek)
          : undefined,
      monthlyDayOfMonth:
        dto.pattern.type === 'Monthly' ? dto.pattern.dayOfMonth : undefined,
      startDate: dto.startDate,
      endDate: dto.endDate ?? undefined,
    },
  }
}

/**
 * 曜日文字列を数値に変換
 */
function dayOfWeekToNumber(dayOfWeek: string): number {
  const map: Record<string, number> = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
    SUNDAY: 7,
  }
  return map[dayOfWeek] ?? 1
}

/**
 * タスク定義管理カスタムフック
 *
 * @param initialTaskDefinitions - 初期タスク定義リスト
 * @returns タスク定義状態とアクション
 *
 * @example
 * ```tsx
 * const { taskDefinitions, loading, error, addTaskDefinition } = useTaskDefinition(initialData)
 *
 * const handleAdd = async () => {
 *   const success = await addTaskDefinition({
 *     name: 'お風呂掃除',
 *     description: '浴槽を洗う',
 *     estimatedMinutes: 15,
 *     scope: 'FAMILY',
 *     schedule: { type: 'Recurring', pattern: { type: 'Daily', skipWeekends: false }, startDate: '2024-01-01' }
 *   })
 * }
 * ```
 */
export function useTaskDefinition(
  initialTaskDefinitions: TaskDefinition[] = []
): UseTaskDefinitionReturn {
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>(
    initialTaskDefinitions
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * タスク定義一覧をAPIから取得
   */
  const fetchTaskDefinitions = useCallback(
    async (limit?: number, offset?: number): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const response = await getTaskDefinitions(limit, offset)

        const fetchedTaskDefs: TaskDefinition[] = response.taskDefinitions.map((td) => {
          const scheduleInfo = scheduleDtoToTaskDefinition(td.schedule)
          return {
            id: td.id,
            name: td.name,
            description: td.description,
            scheduledTimeRange: td.scheduledTimeRange,
            scope: td.scope as 'FAMILY' | 'PERSONAL',
            ownerMemberId: td.ownerMemberId ?? undefined,
            ...scheduleInfo,
            version: td.version,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        })

        setTaskDefinitions(fetchedTaskDefs)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('タスク定義の取得に失敗しました')
        }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * タスク定義を追加
   */
  const addTaskDefinition = useCallback(
    async (request: CreateTaskDefinitionRequest): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await createTaskDefinition(request)

        // APIレスポンスから新しいタスク定義を作成
        const scheduleInfo = scheduleDtoToTaskDefinition(response.schedule)
        const newTaskDef: TaskDefinition = {
          id: response.id,
          name: response.name,
          description: response.description,
          scheduledTimeRange: response.scheduledTimeRange,
          scope: response.scope as 'FAMILY' | 'PERSONAL',
          ownerMemberId: response.ownerMemberId ?? undefined,
          ...scheduleInfo,
          version: response.version,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setTaskDefinitions((prev) => [...prev, newTaskDef])
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('タスク定義の作成に失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * タスク定義を更新
   */
  const editTaskDefinition = useCallback(
    async (id: string, request: UpdateTaskDefinitionRequest): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await updateTaskDefinition(id, request)

        // ローカル状態を更新
        const scheduleInfo = scheduleDtoToTaskDefinition(response.schedule)
        setTaskDefinitions((prev) =>
          prev.map((taskDef) =>
            taskDef.id === id
              ? {
                  ...taskDef,
                  name: response.name,
                  description: response.description,
                  scheduledTimeRange: response.scheduledTimeRange,
                  scope: response.scope as 'FAMILY' | 'PERSONAL',
                  ownerMemberId: response.ownerMemberId ?? undefined,
                  ...scheduleInfo,
                  version: response.version,
                  updatedAt: new Date().toISOString(),
                }
              : taskDef
          )
        )
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('タスク定義の更新に失敗しました')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * タスク定義を削除
   */
  const removeTaskDefinition = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      await deleteTaskDefinition(id)

      // ローカル状態を更新（論理削除）
      setTaskDefinitions((prev) =>
        prev.map((taskDef) =>
          taskDef.id === id ? { ...taskDef, isDeleted: true } : taskDef
        )
      )
      return true
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('タスク定義の削除に失敗しました')
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    taskDefinitions,
    loading,
    error,
    fetchTaskDefinitions,
    addTaskDefinition,
    editTaskDefinition,
    removeTaskDefinition,
    setTaskDefinitions,
    clearError,
  }
}

