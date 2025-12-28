/**
 * BottomNavコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from '../BottomNav'

const renderWithRouter = (route = '/') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  describe('レンダリング', () => {
    it('4つのナビゲーションリンクが表示される', () => {
      renderWithRouter()
      expect(screen.getByText('ホーム')).toBeInTheDocument()
      expect(screen.getByText('タスク')).toBeInTheDocument()
      expect(screen.getByText('メンバー')).toBeInTheDocument()
      expect(screen.getByText('空き時間')).toBeInTheDocument()
    })

    it('nav要素としてレンダリングされる', () => {
      renderWithRouter()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('4つのリンクがレンダリングされる', () => {
      renderWithRouter()
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(4)
    })
  })

  describe('リンク先', () => {
    it('ホームは/にリンクする', () => {
      renderWithRouter()
      const homeLink = screen.getByText('ホーム').closest('a')
      expect(homeLink).toHaveAttribute('href', '/')
    })

    it('タスクは/tasksにリンクする', () => {
      renderWithRouter()
      const tasksLink = screen.getByText('タスク').closest('a')
      expect(tasksLink).toHaveAttribute('href', '/tasks')
    })

    it('メンバーは/membersにリンクする', () => {
      renderWithRouter()
      const membersLink = screen.getByText('メンバー').closest('a')
      expect(membersLink).toHaveAttribute('href', '/members')
    })

    it('空き時間は/availabilityにリンクする', () => {
      renderWithRouter()
      const availabilityLink = screen.getByText('空き時間').closest('a')
      expect(availabilityLink).toHaveAttribute('href', '/availability')
    })
  })

  describe('アクティブ状態', () => {
    it('現在のルートに対応するリンクにcoral系の色が適用される', () => {
      renderWithRouter('/')
      const homeLink = screen.getByText('ホーム').closest('a')
      expect(homeLink).toHaveClass('text-coral-400')
    })

    it('/tasksでタスクリンクがアクティブになる', () => {
      renderWithRouter('/tasks')
      const tasksLink = screen.getByText('タスク').closest('a')
      expect(tasksLink).toHaveClass('text-coral-400')
    })

    it('/membersでメンバーリンクがアクティブになる', () => {
      renderWithRouter('/members')
      const membersLink = screen.getByText('メンバー').closest('a')
      expect(membersLink).toHaveClass('text-coral-400')
    })

    it('/availabilityで空き時間リンクがアクティブになる', () => {
      renderWithRouter('/availability')
      const availabilityLink = screen.getByText('空き時間').closest('a')
      expect(availabilityLink).toHaveClass('text-coral-400')
    })

    it('非アクティブなリンクにdark系の色が適用される', () => {
      renderWithRouter('/')
      const tasksLink = screen.getByText('タスク').closest('a')
      expect(tasksLink).toHaveClass('text-dark-400')
    })
  })

  describe('固定位置', () => {
    it('fixed positionが適用される', () => {
      renderWithRouter()
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('fixed', 'bottom-0')
    })

    it('z-50クラスが適用される（最前面）', () => {
      renderWithRouter()
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('z-50')
    })
  })
})

