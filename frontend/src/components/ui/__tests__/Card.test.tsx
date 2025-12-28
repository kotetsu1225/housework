/**
 * Cardコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardContent } from '../Card'

describe('Card', () => {
  describe('レンダリング', () => {
    it('子要素を正しく表示する', () => {
      render(<Card>カード内容</Card>)
      expect(screen.getByText('カード内容')).toBeInTheDocument()
    })
  })

  describe('variant', () => {
    it('defaultバリアントのスタイルが適用される', () => {
      const { container } = render(<Card variant="default">デフォルト</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-dark-800')
    })

    it('glassバリアントのスタイルが適用される', () => {
      const { container } = render(<Card variant="glass">ガラス</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('backdrop-blur-lg')
    })

    it('gradientバリアントのスタイルが適用される', () => {
      const { container } = render(<Card variant="gradient">グラデーション</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-gradient-to-br')
    })
  })

  describe('hoverable', () => {
    it('hoverableがtrueの場合hover関連クラスが適用される', () => {
      const { container } = render(<Card hoverable>ホバー可能</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('cursor-pointer')
    })

    it('hoverableがfalseの場合hover関連クラスが適用されない', () => {
      const { container } = render(<Card hoverable={false}>ホバー不可</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).not.toHaveClass('cursor-pointer')
    })
  })

  describe('クリックイベント', () => {
    it('onClickハンドラが呼ばれる', () => {
      const handleClick = vi.fn()
      render(<Card onClick={handleClick}>クリック可能</Card>)
      fireEvent.click(screen.getByText('クリック可能'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('共通スタイル', () => {
    it('rounded-2xlクラスが適用される', () => {
      const { container } = render(<Card>テスト</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('rounded-2xl')
    })

    it('p-4クラスが適用される', () => {
      const { container } = render(<Card>テスト</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('p-4')
    })
  })
})

describe('CardHeader', () => {
  it('子要素を正しく表示する', () => {
    render(<CardHeader>ヘッダー</CardHeader>)
    expect(screen.getByText('ヘッダー')).toBeInTheDocument()
  })

  it('mb-3クラスが適用される', () => {
    render(<CardHeader>ヘッダー</CardHeader>)
    expect(screen.getByText('ヘッダー')).toHaveClass('mb-3')
  })
})

describe('CardTitle', () => {
  it('子要素を正しく表示する', () => {
    render(<CardTitle>タイトル</CardTitle>)
    expect(screen.getByText('タイトル')).toBeInTheDocument()
  })

  it('h3要素としてレンダリングされる', () => {
    render(<CardTitle>タイトル</CardTitle>)
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  })

  it('適切なスタイルが適用される', () => {
    render(<CardTitle>タイトル</CardTitle>)
    const title = screen.getByText('タイトル')
    expect(title).toHaveClass('text-lg', 'font-bold', 'text-white')
  })
})

describe('CardContent', () => {
  it('子要素を正しく表示する', () => {
    render(<CardContent>コンテンツ</CardContent>)
    expect(screen.getByText('コンテンツ')).toBeInTheDocument()
  })

  it('text-dark-300クラスが適用される', () => {
    render(<CardContent>コンテンツ</CardContent>)
    expect(screen.getByText('コンテンツ')).toHaveClass('text-dark-300')
  })
})

