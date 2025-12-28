/**
 * MemberSummaryCardコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemberSummaryCard } from '../MemberSummaryCard'
import type { Member } from '../../../types'

const mockMember: Member = {
  id: 'member-1',
  name: '太郎',
  role: 'BROTHER',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('MemberSummaryCard', () => {
  describe('レンダリング', () => {
    it('メンバー名が表示される', () => {
      render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={2}
          totalCount={3}
        />
      )
      expect(screen.getByText('太郎')).toBeInTheDocument()
    })

    it('完了数/総数が表示される', () => {
      render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={2}
          totalCount={3}
        />
      )
      expect(screen.getByText('2/3完了')).toBeInTheDocument()
    })

    it('タスクがない場合は"タスクなし"が表示される', () => {
      render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
        />
      )
      expect(screen.getByText('タスクなし')).toBeInTheDocument()
    })
  })

  describe('アバター', () => {
    it('メンバー名のイニシャルがアバターに表示される', () => {
      render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
        />
      )
      expect(screen.getByText('太')).toBeInTheDocument()
    })

    it('親役割のメンバーにparent variantが適用される', () => {
      const parentMember: Member = { ...mockMember, role: 'FATHER' }
      render(
        <MemberSummaryCard
          member={parentMember}
          completedCount={0}
          totalCount={0}
        />
      )
      const avatar = screen.getByText('太').closest('div')
      expect(avatar).toHaveClass('from-coral-400')
    })

    it('子役割のメンバーにchild variantが適用される', () => {
      render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
        />
      )
      const avatar = screen.getByText('太').closest('div')
      // 子役割のアバターはcoral以外の色
      expect(avatar?.className).not.toMatch(/from-coral/)
    })

    it('lgサイズのアバターが表示される', () => {
      render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
        />
      )
      const avatar = screen.getByText('太').closest('div')
      expect(avatar).toHaveClass('w-12', 'h-12')
    })
  })

  describe('クリックイベント', () => {
    it('カードクリックでonClickが呼ばれる', () => {
      const onClick = vi.fn()
      render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
          onClick={onClick}
        />
      )
      fireEvent.click(screen.getByText('太郎'))
      expect(onClick).toHaveBeenCalledWith(mockMember)
    })
  })

  describe('カードスタイル', () => {
    it('固定幅w-28が適用される', () => {
      const { container } = render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
        />
      )
      const card = container.querySelector('.w-28')
      expect(card).toBeInTheDocument()
    })

    it('flex-shrink-0が適用される（横スクロール用）', () => {
      const { container } = render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
        />
      )
      const card = container.querySelector('.flex-shrink-0')
      expect(card).toBeInTheDocument()
    })

    it('テキスト中央揃えが適用される', () => {
      const { container } = render(
        <MemberSummaryCard
          member={mockMember}
          completedCount={0}
          totalCount={0}
        />
      )
      const card = container.querySelector('.text-center')
      expect(card).toBeInTheDocument()
    })
  })
})

