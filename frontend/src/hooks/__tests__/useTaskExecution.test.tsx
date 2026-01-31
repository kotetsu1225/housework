/**
 * useTaskExecutionフックのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTaskExecution } from '../useTaskExecution'
import * as api from '../../api'
import type { TaskExecution } from '../../types'

// APIモジュールをモック
vi.mock('../../api', () => ({
  getTaskExecutions: vi.fn(),
  getTaskExecution: vi.fn(),
  startTaskExecution: vi.fn(),
  completeTaskExecution: vi.fn(),
  cancelTaskExecution: vi.fn(),
  assignTaskExecution: vi.fn(),
  generateTaskExecutions: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

const mockTaskExecutions: TaskExecution[] = [
  {
    id: 'exec-1',
    taskDefinitionId: 'def-1',
    assigneeMemberIds: ['member-1'],
    scheduledDate: '2024-01-15',
    status: 'NOT_STARTED',
    taskSnapshot: {
      name: 'お風呂掃除',
      description: '浴槽を洗う',
      scheduledStartTime: '2024-01-15T20:00:00Z',
      scheduledEndTime: '2024-01-15T20:15:00Z',
      definitionVersion: 1,
      frozenPoint: 10,
      capturedAt: '2024-01-15T00:00:00Z',
    },
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
]

const mockApiResponse = {
  id: 'exec-1',
  taskDefinitionId: 'def-1',
  assigneeMemberIds: ['member-1'],
  scheduledDate: '2024-01-15',
  status: 'NOT_STARTED',
  taskSnapshot: {
    name: 'お風呂掃除',
    description: '浴槽を洗う',
    scheduledStartTime: '2024-01-15T20:00:00Z',
    scheduledEndTime: '2024-01-15T20:15:00Z',
    definitionVersion: 1,
    frozenPoint: 10,
    capturedAt: '2024-01-15T00:00:00Z',
  },
  startedAt: null,
  completedAt: null,
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
}

describe('useTaskExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期値なしで空配列が返される', () => {
      const { result } = renderHook(() => useTaskExecution())
      expect(result.current.taskExecutions).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('初期値ありで初期値が返される', () => {
      const { result } = renderHook(() => useTaskExecution(mockTaskExecutions))
      expect(result.current.taskExecutions).toEqual(mockTaskExecutions)
    })
  })

  describe('fetchTaskExecutions', () => {
    it('タスク実行一覧を取得できる', async () => {
      vi.mocked(api.getTaskExecutions).mockResolvedValueOnce({
        taskExecutions: [mockApiResponse],
        total: 1,
        hasMore: false,
      })

      const { result } = renderHook(() => useTaskExecution())

      await act(async () => {
        await result.current.fetchTaskExecutions({ date: '2024-01-15' })
      })

      expect(result.current.taskExecutions).toHaveLength(1)
      expect(result.current.taskExecutions[0].taskSnapshot.name).toBe('お風呂掃除')
    })

    it('取得中はloadingがtrueになる', async () => {
      vi.mocked(api.getTaskExecutions).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const { result } = renderHook(() => useTaskExecution())

      act(() => {
        result.current.fetchTaskExecutions()
      })

      expect(result.current.loading).toBe(true)
    })

    it('エラー時にerrorが設定される', async () => {
      vi.mocked(api.getTaskExecutions).mockRejectedValueOnce(new Error('取得エラー'))

      const { result } = renderHook(() => useTaskExecution())

      await act(async () => {
        await result.current.fetchTaskExecutions()
      })

      expect(result.current.error).toBe('取得エラー')
    })
  })

  describe('startTask', () => {
    it('タスクを開始できる', async () => {
      vi.mocked(api.startTaskExecution).mockResolvedValueOnce({
        ...mockApiResponse,
        status: 'IN_PROGRESS',
        startedAt: '2024-01-15T10:00:00Z',
      })

      const { result } = renderHook(() => useTaskExecution(mockTaskExecutions))

      let success: boolean
      await act(async () => {
        success = await result.current.startTask('exec-1', ['member-1'])
      })

      expect(success!).toBe(true)
      expect(result.current.taskExecutions[0].status).toBe('IN_PROGRESS')
    })

    it('開始失敗時はfalseを返す', async () => {
      vi.mocked(api.startTaskExecution).mockRejectedValueOnce(new Error('開始失敗'))

      const { result } = renderHook(() => useTaskExecution(mockTaskExecutions))

      let success: boolean
      await act(async () => {
        success = await result.current.startTask('exec-1', ['member-1'])
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe('開始失敗')
    })
  })

  describe('completeTask', () => {
    it('タスクを完了できる', async () => {
      const inProgressTask: TaskExecution = {
        ...mockTaskExecutions[0],
        status: 'IN_PROGRESS',
        startedAt: '2024-01-15T10:00:00Z',
      }

      vi.mocked(api.completeTaskExecution).mockResolvedValueOnce({
        ...mockApiResponse,
        status: 'COMPLETED',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T11:00:00Z',
      })

      const { result } = renderHook(() => useTaskExecution([inProgressTask]))

      let success: boolean
      await act(async () => {
        success = await result.current.completeTask('exec-1')
      })

      expect(success!).toBe(true)
      expect(result.current.taskExecutions[0].status).toBe('COMPLETED')
    })
  })

  describe('cancelTask', () => {
    it('タスクをキャンセルできる', async () => {
      vi.mocked(api.cancelTaskExecution).mockResolvedValueOnce({
        ...mockApiResponse,
        status: 'CANCELLED',
      })

      const { result } = renderHook(() => useTaskExecution(mockTaskExecutions))

      let success: boolean
      await act(async () => {
        success = await result.current.cancelTask('exec-1')
      })

      expect(success!).toBe(true)
      expect(result.current.taskExecutions[0].status).toBe('CANCELLED')
    })
  })

  describe('assignTask', () => {
    it('担当者を割り当てできる', async () => {
      vi.mocked(api.assignTaskExecution).mockResolvedValueOnce({
        ...mockApiResponse,
        assigneeMemberIds: ['member-2'],
      })

      const { result } = renderHook(() => useTaskExecution(mockTaskExecutions))

      let success: boolean
      await act(async () => {
        success = await result.current.assignTask('exec-1', ['member-2'])
      })

      expect(success!).toBe(true)
      expect(result.current.taskExecutions[0].assigneeMemberIds).toEqual(['member-2'])
    })
  })

  describe('generateTasks', () => {
    it('タスクを一括生成できる', async () => {
      vi.mocked(api.generateTaskExecutions).mockResolvedValueOnce({
        taskExecutionIds: ['exec-new'],
        generatedCount: 1,
        targetDate: '2024-01-15'
      })

      const { result } = renderHook(() => useTaskExecution())

      let success: boolean
      await act(async () => {
        success = await result.current.generateTasks('2024-01-15')
      })

      expect(success!).toBe(true)
      // generateTasks does not update taskExecutions list
    })
  })

  describe('refreshTaskExecution', () => {
    it('単一タスクを更新できる', async () => {
      vi.mocked(api.getTaskExecution).mockResolvedValueOnce({
        ...mockApiResponse,
        status: 'COMPLETED',
      })

      const { result } = renderHook(() => useTaskExecution(mockTaskExecutions))

      await act(async () => {
        await result.current.refreshTaskExecution('exec-1')
      })

      expect(result.current.taskExecutions[0].status).toBe('COMPLETED')
    })
  })

  describe('setTaskExecutions', () => {
    it('タスク実行一覧を直接設定できる', () => {
      const { result } = renderHook(() => useTaskExecution())

      act(() => {
        result.current.setTaskExecutions(mockTaskExecutions)
      })

      expect(result.current.taskExecutions).toEqual(mockTaskExecutions)
    })
  })

  describe('clearError', () => {
    it('エラーをクリアできる', async () => {
      vi.mocked(api.getTaskExecutions).mockRejectedValueOnce(new Error('エラー'))

      const { result } = renderHook(() => useTaskExecution())

      await act(async () => {
        await result.current.fetchTaskExecutions()
      })

      expect(result.current.error).toBe('エラー')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
