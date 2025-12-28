/**
 * TaskCardコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskCard } from '../TaskCard'
import type { TaskExecution, Member } from '../../../types'

const mockTask: TaskExecution = {
  id: 'task-1',
  taskDefinitionId: 'def-1',
  assigneeMemberId: 'member-1',
  scheduledDate: '2024-01-15',
  status: 'NOT_STARTED',
  taskSnapshot: {
    name: 'お風呂掃除',
    description: '浴槽を洗う',
    estimatedMinutes: 15,
    definitionVersion: 1,
    createdAt: '2024-01-15T00:00:00Z',
  },
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
}

const mockMember: Member = {
  id: 'member-1',
  name: '太郎',
  role: 'BROTHER',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('TaskCard', () => {
  describe('レンダリング', () => {
    it('タスク名が表示される', () => {
      render(<TaskCard task={mockTask} />)
      expect(screen.getByText('お風呂掃除')).toBeInTheDocument()
    })

    it('見積時間が表示される', () => {
      render(<TaskCard task={mockTask} />)
      expect(screen.getByText('15分')).toBeInTheDocument()
    })

    it('担当者が表示される', () => {
      render(<TaskCard task={mockTask} assignee={mockMember} />)
      expect(screen.getByText('太郎')).toBeInTheDocument()
    })

    it('担当者がいない場合は表示されない', () => {
      render(<TaskCard task={mockTask} />)
      expect(screen.queryByText('太郎')).not.toBeInTheDocument()
    })
  })

  describe('ステータス表示', () => {
    it('NOT_STARTEDで"未着手"バッジが表示される', () => {
      render(<TaskCard task={{ ...mockTask, status: 'NOT_STARTED' }} />)
      expect(screen.getByText('未着手')).toBeInTheDocument()
    })

    it('IN_PROGRESSで"実行中"バッジが表示される', () => {
      render(<TaskCard task={{ ...mockTask, status: 'IN_PROGRESS' }} />)
      expect(screen.getByText('実行中')).toBeInTheDocument()
    })

    it('COMPLETEDで"完了"バッジが表示される', () => {
      render(<TaskCard task={{ ...mockTask, status: 'COMPLETED' }} />)
      expect(screen.getByText('完了')).toBeInTheDocument()
    })

    it('CANCELLEDで"キャンセル"バッジが表示される', () => {
      render(<TaskCard task={{ ...mockTask, status: 'CANCELLED' }} />)
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
    })
  })

  describe('完了状態のスタイル', () => {
    it('COMPLETEDでタスク名に取り消し線が適用される', () => {
      render(<TaskCard task={{ ...mockTask, status: 'COMPLETED' }} />)
      const taskName = screen.getByText('お風呂掃除')
      expect(taskName).toHaveClass('line-through')
    })

    it('CANCELLEDでタスク名に取り消し線が適用される', () => {
      render(<TaskCard task={{ ...mockTask, status: 'CANCELLED' }} />)
      const taskName = screen.getByText('お風呂掃除')
      expect(taskName).toHaveClass('line-through')
    })

    it('NOT_STARTEDではタスク名に取り消し線が適用されない', () => {
      render(<TaskCard task={{ ...mockTask, status: 'NOT_STARTED' }} />)
      const taskName = screen.getByText('お風呂掃除')
      expect(taskName).not.toHaveClass('line-through')
    })
  })

  describe('クリックイベント', () => {
    it('カードクリックでonClickが呼ばれる', () => {
      const onClick = vi.fn()
      render(<TaskCard task={mockTask} onClick={onClick} />)
      // Card要素をクリック
      fireEvent.click(screen.getByText('お風呂掃除').closest('div[class*="rounded-2xl"]')!)
      expect(onClick).toHaveBeenCalledWith(mockTask)
    })

    it('ステータスアイコンクリックでonStatusClickが呼ばれる', () => {
      const onStatusClick = vi.fn()
      render(<TaskCard task={mockTask} onStatusClick={onStatusClick} />)
      const statusButton = screen.getByLabelText(/ステータス/)
      fireEvent.click(statusButton)
      expect(onStatusClick).toHaveBeenCalledWith(mockTask)
    })

    it('ステータスアイコンクリックでonClickは呼ばれない（伝播停止）', () => {
      const onClick = vi.fn()
      const onStatusClick = vi.fn()
      render(<TaskCard task={mockTask} onClick={onClick} onStatusClick={onStatusClick} />)
      const statusButton = screen.getByLabelText(/ステータス/)
      fireEvent.click(statusButton)
      expect(onStatusClick).toHaveBeenCalled()
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('担当者アバター', () => {
    it('親役割の担当者にparent variantが適用される', () => {
      const parentMember: Member = { ...mockMember, role: 'FATHER' }
      render(<TaskCard task={mockTask} assignee={parentMember} />)
      // 親役割のアバターはcoral系の色を持つ
      const avatar = screen.getByText('太').closest('div')
      expect(avatar).toHaveClass('from-coral-400')
    })

    it('子役割の担当者にchild variantが適用される', () => {
      render(<TaskCard task={mockTask} assignee={mockMember} />)
      const avatar = screen.getByText('太').closest('div')
      // 子役割のアバターはcoral以外の色
      expect(avatar?.className).not.toMatch(/from-coral/)
    })
  })
})

