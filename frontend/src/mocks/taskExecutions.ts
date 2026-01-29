/**
 * タスク実行関連のモックデータ
 *
 * @note バックエンドのTaskExecution APIが実装されるまでの暫定データ
 * @see doc/task-execution-api.md
 */

import type { TaskExecution, ExecutionStatus } from '../types'
import { toISODateString } from '../utils'

/**
 * 今日の日付を取得（モックデータ用）
 */
const TODAY = toISODateString(new Date())

/**
 * モックタスク実行データ
 *
 * Dashboard画面で使用される「今日のタスク」のサンプルデータ
 */
export const MOCK_TASK_EXECUTIONS: TaskExecution[] = [
  {
    id: 'exec-1',
    taskDefinitionId: 'def-1',
    assigneeMemberId: '2',
    scheduledDate: TODAY,
    status: 'COMPLETED',
    taskSnapshot: {
      name: 'お風呂掃除',
      description: '浴槽と床を洗う',
      scheduledStartTime: '2025-01-01T20:00:00Z',
      scheduledEndTime: '2025-01-01T20:15:00Z',
      definitionVersion: 1,
      capturedAt: new Date().toISOString(),
    },
    startedAt: new Date(Date.now() - 3600000).toISOString(), // 1時間前
    completedAt: new Date(Date.now() - 2700000).toISOString(), // 45分前
    completedByMemberId: '2',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1日前
    updatedAt: new Date(Date.now() - 2700000).toISOString(),
  },
  {
    id: 'exec-2',
    taskDefinitionId: 'def-2',
    assigneeMemberId: '3',
    scheduledDate: TODAY,
    status: 'IN_PROGRESS',
    taskSnapshot: {
      name: '洗濯物を干す',
      description: '洗濯機を回してからベランダに干す',
      scheduledStartTime: '2025-01-01T08:00:00Z',
      scheduledEndTime: '2025-01-01T08:20:00Z',
      definitionVersion: 1,
      capturedAt: new Date().toISOString(),
    },
    startedAt: new Date(Date.now() - 1800000).toISOString(), // 30分前
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'exec-3',
    taskDefinitionId: 'def-3',
    scheduledDate: TODAY,
    status: 'NOT_STARTED',
    taskSnapshot: {
      name: '夕食の準備',
      description: 'カレーを作る',
      scheduledStartTime: '2025-01-01T17:30:00Z',
      scheduledEndTime: '2025-01-01T18:15:00Z',
      definitionVersion: 1,
      capturedAt: '',
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'exec-4',
    taskDefinitionId: 'def-4',
    assigneeMemberId: '2',
    scheduledDate: TODAY,
    status: 'NOT_STARTED',
    taskSnapshot: {
      name: 'ゴミ出し',
      description: '燃えるゴミを出す',
      scheduledStartTime: '2025-01-01T07:45:00Z',
      scheduledEndTime: '2025-01-01T07:50:00Z',
      definitionVersion: 1,
      capturedAt: '',
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'exec-5',
    taskDefinitionId: 'def-5',
    assigneeMemberId: '4',
    scheduledDate: TODAY,
    status: 'CANCELLED',
    taskSnapshot: {
      name: '買い物',
      description: '牛乳と卵を買う',
      scheduledStartTime: '2025-01-01T16:00:00Z',
      scheduledEndTime: '2025-01-01T17:00:00Z',
      definitionVersion: 1,
      capturedAt: new Date().toISOString(),
    },
    startedAt: new Date(Date.now() - 7200000).toISOString(), // 2時間前
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
]

/**
 * タスク実行IDからタスク実行を取得
 */
export function getMockTaskExecutionById(id: string): TaskExecution | undefined {
  return MOCK_TASK_EXECUTIONS.find((exec) => exec.id === id)
}

/**
 * 指定日のタスク実行を取得
 */
export function getMockTaskExecutionsByDate(date: string): TaskExecution[] {
  return MOCK_TASK_EXECUTIONS.filter((exec) => exec.scheduledDate === date)
}

/**
 * 指定ステータスのタスク実行を取得
 */
export function getMockTaskExecutionsByStatus(status: ExecutionStatus): TaskExecution[] {
  return MOCK_TASK_EXECUTIONS.filter((exec) => exec.status === status)
}

/**
 * 指定メンバーのタスク実行を取得
 */
export function getMockTaskExecutionsByMember(memberId: string): TaskExecution[] {
  return MOCK_TASK_EXECUTIONS.filter((exec) => exec.assigneeMemberId === memberId)
}

/**
 * 今日のタスクサマリーを取得
 */
export function getMockTodayTaskSummary(): {
  total: number
  completed: number
  inProgress: number
  notStarted: number
  cancelled: number
} {
  const todayTasks = getMockTaskExecutionsByDate(TODAY)

  return {
    total: todayTasks.length,
    completed: todayTasks.filter((t) => t.status === 'COMPLETED').length,
    inProgress: todayTasks.filter((t) => t.status === 'IN_PROGRESS').length,
    notStarted: todayTasks.filter((t) => t.status === 'NOT_STARTED').length,
    cancelled: todayTasks.filter((t) => t.status === 'CANCELLED').length,
  }
}