/**
 * タスク定義関連のモックデータ
 *
 * @note バックエンドにGETエンドポイントが追加されるまでの暫定データ
 * @see docs/BACKEND_ISSUES.md - GETエンドポイントの欠如
 */

import type { TaskDefinition } from '../types'

/**
 * モックタスク定義データ
 */
export const MOCK_TASK_DEFINITIONS: TaskDefinition[] = [
  {
    id: '1',
    name: 'お風呂掃除',
    description: '浴槽と床を洗う。排水溝も忘れずに。',
    scheduledTimeRange: {
      startTime: '2024-01-01T20:00:00Z',
      endTime: '2024-01-01T20:15:00Z',
    },
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: false,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: '洗濯物を干す',
    description: '洗濯機を回してからベランダに干す',
    scheduledTimeRange: {
      startTime: '2024-01-01T08:00:00Z',
      endTime: '2024-01-01T08:20:00Z',
    },
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: true,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: '夕食の準備',
    description: 'メニューは冷蔵庫に貼ってある献立表を参照',
    scheduledTimeRange: {
      startTime: '2024-01-01T17:30:00Z',
      endTime: '2024-01-01T18:15:00Z',
    },
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: false,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'ゴミ出し',
    description: '月曜日と木曜日が燃えるゴミ、水曜日がプラスチック',
    scheduledTimeRange: {
      startTime: '2024-01-01T07:45:00Z',
      endTime: '2024-01-01T07:50:00Z',
    },
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'WEEKLY',
      weeklyDayOfWeek: 2,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: '宿題',
    description: '学校の宿題をやる',
    scheduledTimeRange: {
      startTime: '2024-01-01T16:00:00Z',
      endTime: '2024-01-01T17:00:00Z',
    },
    scope: 'PERSONAL',
    ownerMemberId: '2',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: true,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

/**
 * タスク定義IDからタスク定義を取得
 */
export function getMockTaskDefinitionById(id: string): TaskDefinition | undefined {
  return MOCK_TASK_DEFINITIONS.find((td) => td.id === id)
}