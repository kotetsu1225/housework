import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TomorrowTaskDetailModal } from '../TomorrowTaskDetailModal'
import type { TodayTaskDto } from '../../../api/dashboard'
import type { Member } from '../../../types'

const members: Member[] = [
  {
    id: 'member-1',
    name: '太郎',
    email: 'taro@example.com',
    role: 'BROTHER',
    todayEarnedPoint: 10,
    todayFamilyTaskCompleted: 2,
    todayPersonalTaskCompleted: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

const task: TodayTaskDto = {
  taskExecutionId: 'exec-1',
  taskDefinitionId: 'def-1',
  taskName: 'お風呂掃除',
  taskDescription: '浴槽を洗う\n排水口も確認する',
  scheduledStartTime: '2024-01-15T20:00:00Z',
  scheduledEndTime: '2024-01-15T20:15:00Z',
  scope: 'FAMILY',
  scheduleType: 'RECURRING',
  status: 'NOT_STARTED',
  ownerMemberId: null,
  assigneeMemberIds: ['member-1'],
  assigneeMemberNames: ['太郎'],
  scheduledDate: '2024-01-16',
  point: 5,
  frozenPoint: null,
}

describe('TomorrowTaskDetailModal', () => {
  it('タスク名・説明・担当者が表示される', () => {
    render(
      <TomorrowTaskDetailModal
        isOpen
        task={task}
        members={members}
        onClose={() => {}}
        onBackToList={() => {}}
      />
    )

    expect(screen.getByText('タスク詳細')).toBeInTheDocument()
    expect(screen.getByText('お風呂掃除')).toBeInTheDocument()
    expect(screen.getByText('説明')).toBeInTheDocument()
    expect(screen.getByText(/浴槽を洗う/)).toBeInTheDocument()
    expect(screen.getByText('太郎')).toBeInTheDocument()
  })

  it('一覧に戻るボタンでコールバックが呼ばれる', () => {
    const onBackToList = vi.fn()

    render(
      <TomorrowTaskDetailModal
        isOpen
        task={task}
        members={members}
        onClose={() => {}}
        onBackToList={onBackToList}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '一覧に戻る' }))
    expect(onBackToList).toHaveBeenCalledTimes(1)
  })
})

