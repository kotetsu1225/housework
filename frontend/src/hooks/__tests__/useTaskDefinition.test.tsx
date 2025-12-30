/**
 * useTaskDefinitionフックのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTaskDefinition } from '../useTaskDefinition'
import * as api from '../../api'
import type { TaskDefinition } from '../../types'

// APIモジュールをモック
vi.mock('../../api', () => ({
  getTaskDefinitions: vi.fn(),
  createTaskDefinition: vi.fn(),
  updateTaskDefinition: vi.fn(),
  deleteTaskDefinition: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

const mockTaskDefinitions: TaskDefinition[] = [
  {
    id: 'task-def-1',
    name: 'お風呂掃除',
    description: '浴槽を洗う',
    scheduledTimeRange: {
      startTime: '2024-01-01T20:00:00Z',
      endTime: '2024-01-01T20:15:00Z',
    },
    estimatedMinutes: 15, // 後方互換性のため残す場合は残すが、今回は削除
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
]

describe('useTaskDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期値なしで空配列が返される', () => {
      const { result } = renderHook(() => useTaskDefinition())
      expect(result.current.taskDefinitions).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('初期値ありで初期値が返される', () => {
      const { result } = renderHook(() => useTaskDefinition(mockTaskDefinitions))
      expect(result.current.taskDefinitions).toEqual(mockTaskDefinitions)
    })
  })

  describe('fetchTaskDefinitions', () => {
    it('タスク定義一覧を取得できる', async () => {
      vi.mocked(api.getTaskDefinitions).mockResolvedValueOnce({
        taskDefinitions: [
          {
            id: 'task-def-1',
            name: 'お風呂掃除',
            description: '浴槽を洗う',
            scheduledTimeRange: {
              startTime: '2024-01-01T20:00:00Z',
              endTime: '2024-01-01T20:15:00Z',
            },
            estimatedMinutes: 15, // 型定義から削除したので不要だが、もし型に残っているなら...
            scope: 'FAMILY',
            ownerMemberId: null,
            schedule: {
              type: 'Recurring',
              pattern: { type: 'Daily', skipWeekends: false },
              startDate: '2024-01-01',
              endDate: null,
            },
            version: 1,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      })

      const { result } = renderHook(() => useTaskDefinition())

      await act(async () => {
        await result.current.fetchTaskDefinitions()
      })

      expect(result.current.taskDefinitions).toHaveLength(1)
      expect(result.current.taskDefinitions[0].name).toBe('お風呂掃除')
    })

    it('取得中はloadingがtrueになる', async () => {
      vi.mocked(api.getTaskDefinitions).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const { result } = renderHook(() => useTaskDefinition())

      act(() => {
        result.current.fetchTaskDefinitions()
      })

      expect(result.current.loading).toBe(true)
    })

    it('エラー時にerrorが設定される', async () => {
      vi.mocked(api.getTaskDefinitions).mockRejectedValueOnce(
        new Error('取得エラー')
      )

      const { result } = renderHook(() => useTaskDefinition())

      await act(async () => {
        await result.current.fetchTaskDefinitions()
      })

      expect(result.current.error).toBe('取得エラー')
    })
  })

  describe('addTaskDefinition', () => {
    it('タスク定義を追加できる', async () => {
      vi.mocked(api.createTaskDefinition).mockResolvedValueOnce({
        id: 'new-task-def',
        name: '洗濯',
        description: '洗濯をする',
        scheduledTimeRange: {
          startTime: '2024-01-01T08:00:00Z',
          endTime: '2024-01-01T08:30:00Z',
        },
        estimatedMinutes: 30,
        scope: 'FAMILY',
        ownerMemberId: null,
        schedule: {
          type: 'Recurring',
          pattern: { type: 'Daily', skipWeekends: true },
          startDate: '2024-01-01',
          endDate: null,
        },
        version: 1,
      })

      const { result } = renderHook(() => useTaskDefinition())

      let success: boolean
      await act(async () => {
        success = await result.current.addTaskDefinition({
          name: '洗濯',
          description: '洗濯をする',
          scheduledTimeRange: {
            startTime: '2024-01-01T08:00:00Z',
            endTime: '2024-01-01T08:30:00Z',
          },
          estimatedMinutes: 30, // 必要なら残す
          scope: 'FAMILY',
          schedule: {
            type: 'Recurring',
            pattern: { type: 'Daily', skipWeekends: true },
            startDate: '2024-01-01',
          },
        })
      })

      expect(success!).toBe(true)
      expect(result.current.taskDefinitions).toHaveLength(1)
      expect(result.current.taskDefinitions[0].name).toBe('洗濯')
    })

    it('追加失敗時はfalseを返す', async () => {
      vi.mocked(api.createTaskDefinition).mockRejectedValueOnce(
        new Error('作成失敗')
      )

      const { result } = renderHook(() => useTaskDefinition())

      let success: boolean
      await act(async () => {
        success = await result.current.addTaskDefinition({
          name: 'テスト',
          scheduledTimeRange: {
            startTime: '2024-01-01T10:00:00Z',
            endTime: '2024-01-01T10:10:00Z',
          },
          estimatedMinutes: 10,
          scope: 'FAMILY',
          schedule: {
            type: 'OneTime',
            deadline: '2024-12-31',
          },
        })
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe('作成失敗')
    })
  })

  describe('editTaskDefinition', () => {
    it('タスク定義を更新できる', async () => {
      vi.mocked(api.updateTaskDefinition).mockResolvedValueOnce({
        id: 'task-def-1',
        name: 'お風呂掃除（更新）',
        description: '浴槽と床を洗う',
        scheduledTimeRange: {
          startTime: '2024-01-01T20:00:00Z',
          endTime: '2024-01-01T20:20:00Z',
        },
        estimatedMinutes: 20,
        scope: 'FAMILY',
        ownerMemberId: null,
        schedule: {
          type: 'Recurring',
          pattern: { type: 'Daily', skipWeekends: false },
          startDate: '2024-01-01',
          endDate: null,
        },
        version: 2,
      })

      const { result } = renderHook(() => useTaskDefinition(mockTaskDefinitions))

      let success: boolean
      await act(async () => {
        success = await result.current.editTaskDefinition('task-def-1', {
          name: 'お風呂掃除（更新）',
          description: '浴槽と床を洗う',
          scheduledTimeRange: {
            startTime: '2024-01-01T20:00:00Z',
            endTime: '2024-01-01T20:20:00Z',
          },
          estimatedMinutes: 20,
        })
      })

      expect(success!).toBe(true)
      expect(result.current.taskDefinitions[0].name).toBe('お風呂掃除（更新）')
      expect(result.current.taskDefinitions[0].version).toBe(2)
    })
  })

  describe('removeTaskDefinition', () => {
    it('タスク定義を論理削除できる', async () => {
      vi.mocked(api.deleteTaskDefinition).mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useTaskDefinition(mockTaskDefinitions))

      let success: boolean
      await act(async () => {
        success = await result.current.removeTaskDefinition('task-def-1')
      })

      expect(success!).toBe(true)
      expect(result.current.taskDefinitions[0].isDeleted).toBe(true)
    })

    it('削除失敗時はfalseを返す', async () => {
      vi.mocked(api.deleteTaskDefinition).mockRejectedValueOnce(
        new Error('削除失敗')
      )

      const { result } = renderHook(() => useTaskDefinition(mockTaskDefinitions))

      let success: boolean
      await act(async () => {
        success = await result.current.removeTaskDefinition('task-def-1')
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe('削除失敗')
    })
  })

  describe('setTaskDefinitions', () => {
    it('タスク定義一覧を直接設定できる', () => {
      const { result } = renderHook(() => useTaskDefinition())

      act(() => {
        result.current.setTaskDefinitions(mockTaskDefinitions)
      })

      expect(result.current.taskDefinitions).toEqual(mockTaskDefinitions)
    })
  })

  describe('clearError', () => {
    it('エラーをクリアできる', async () => {
      vi.mocked(api.getTaskDefinitions).mockRejectedValueOnce(new Error('エラー'))

      const { result } = renderHook(() => useTaskDefinition())

      await act(async () => {
        await result.current.fetchTaskDefinitions()
      })

      expect(result.current.error).toBe('エラー')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})