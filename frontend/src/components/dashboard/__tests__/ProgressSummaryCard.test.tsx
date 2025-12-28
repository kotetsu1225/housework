/**
 * ProgressSummaryCardコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressSummaryCard } from '../ProgressSummaryCard'

describe('ProgressSummaryCard', () => {
  describe('レンダリング', () => {
    it('完了数/総数が表示される', () => {
      render(<ProgressSummaryCard completedCount={3} totalCount={5} />)
      expect(screen.getByText('3 / 5')).toBeInTheDocument()
    })

    it('デフォルトラベル"今日の進捗"が表示される', () => {
      render(<ProgressSummaryCard completedCount={0} totalCount={0} />)
      expect(screen.getByText('今日の進捗')).toBeInTheDocument()
    })

    it('カスタムラベルが表示される', () => {
      render(
        <ProgressSummaryCard
          completedCount={0}
          totalCount={0}
          label="今週の進捗"
        />
      )
      expect(screen.getByText('今週の進捗')).toBeInTheDocument()
    })
  })

  describe('残りタスク表示', () => {
    it('残りタスクがある場合はメッセージが表示される', () => {
      render(<ProgressSummaryCard completedCount={3} totalCount={5} />)
      expect(screen.getByText('2件のタスクが残っています')).toBeInTheDocument()
    })

    it('すべて完了した場合は完了メッセージが表示される', () => {
      render(<ProgressSummaryCard completedCount={5} totalCount={5} />)
      expect(screen.getByText('すべてのタスクが完了しました！')).toBeInTheDocument()
    })

    it('タスクがない場合は"タスクはありません"が表示される', () => {
      render(<ProgressSummaryCard completedCount={0} totalCount={0} />)
      expect(screen.getByText('タスクはありません')).toBeInTheDocument()
    })

    it('1件残りの場合も正しく表示される', () => {
      render(<ProgressSummaryCard completedCount={4} totalCount={5} />)
      expect(screen.getByText('1件のタスクが残っています')).toBeInTheDocument()
    })
  })

  describe('ProgressRing', () => {
    it('進捗率が正しく計算される（60%）', () => {
      render(<ProgressSummaryCard completedCount={3} totalCount={5} />)
      expect(screen.getByText('60%')).toBeInTheDocument()
    })

    it('0%が正しく表示される', () => {
      render(<ProgressSummaryCard completedCount={0} totalCount={5} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('100%が正しく表示される', () => {
      render(<ProgressSummaryCard completedCount={5} totalCount={5} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('タスクがない場合は0%が表示される', () => {
      render(<ProgressSummaryCard completedCount={0} totalCount={0} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('グラデーションカード', () => {
    it('gradient variantのCardがレンダリングされる', () => {
      const { container } = render(
        <ProgressSummaryCard completedCount={0} totalCount={0} />
      )
      const card = container.querySelector('.bg-gradient-to-br')
      expect(card).toBeInTheDocument()
    })
  })
})

