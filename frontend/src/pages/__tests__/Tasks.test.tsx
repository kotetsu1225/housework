/**
 * Tasksページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Tasks } from '../Tasks'
import * as api from '../../api'

// APIをモック
vi.mock('../../api', () => ({
  getTaskDefinitions: vi.fn(),
  createTaskDefinition: vi.fn(),
  updateTaskDefinition: vi.fn(),
  deleteTaskDefinition: vi.fn(),
  getMembers: vi.fn(),
  getStoredToken: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

const setupAuthUser = () => {
  const user = {
    id: 'test-user',
    name: 'テストユーザー',
    role: 'FATHER',
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem('housework_users', JSON.stringify([user]))
  localStorage.setItem('housework_currentUser', JSON.stringify(user))
}

const renderTasksPage = () => {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <AuthProvider>
        <Tasks />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Tasks', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupAuthUser()
  })

  describe('レンダリング', () => {
    it('ページが正しく読み込まれる', async () => {
      vi.mocked(api.getTaskDefinitions).mockResolvedValue({
        taskDefinitions: [],
        total: 0,
        limit: 20,
        offset: 0,
      })
      vi.mocked(api.getMembers).mockResolvedValue({
        members: [],
      })

      renderTasksPage()

      // ページの読み込みを待つ（ヘッダーの存在で確認）
      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument()
      })
    })
  })

  describe('タスク一覧', () => {
    it('タスクがない場合は空のメッセージが表示される', async () => {
      vi.mocked(api.getTaskDefinitions).mockResolvedValue({
        taskDefinitions: [],
        total: 0,
        limit: 20,
        offset: 0,
      })
      vi.mocked(api.getMembers).mockResolvedValue({
        members: [],
      })

      renderTasksPage()

      await waitFor(() => {
        expect(screen.getByText(/タスク設定が見つかりません/)).toBeInTheDocument()
      })
    })

    it('タスク一覧が表示される', async () => {
      vi.mocked(api.getTaskDefinitions).mockResolvedValue({
        taskDefinitions: [
          {
            id: 'task-1',
            name: 'お風呂掃除',
            description: '浴槽を洗う',
            scheduledTimeRange: {
              startTime: '2024-01-01T20:00:00Z',
              endTime: '2024-01-01T20:15:00Z',
            },
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
      vi.mocked(api.getMembers).mockResolvedValue({
        members: [],
      })

      renderTasksPage()

      await waitFor(() => {
        expect(screen.getByText('お風呂掃除')).toBeInTheDocument()
      })
    })
  })

  describe('タスク追加', () => {
    it('追加ボタンが表示される', async () => {
      vi.mocked(api.getTaskDefinitions).mockResolvedValue({
        taskDefinitions: [],
        total: 0,
        limit: 20,
        offset: 0,
      })
      vi.mocked(api.getMembers).mockResolvedValue({
        members: [],
      })

      renderTasksPage()

      await waitFor(() => {
        // Plus アイコンボタンを探す
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })
})

