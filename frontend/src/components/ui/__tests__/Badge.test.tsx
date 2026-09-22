/**
 * Badgeコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'

describe('Badge', () => {
  describe('レンダリング', () => {
    it('子要素を正しく表示する', () => {
      render(<Badge>ラベル</Badge>)
      expect(screen.getByText('ラベル')).toBeInTheDocument()
    })
  })

  describe('variant', () => {
    it('defaultバリアントのスタイルが適用される', () => {
      render(<Badge variant="default">デフォルト</Badge>)
      expect(screen.getByText('デフォルト')).toHaveClass('bg-control', 'text-ink-soft')
    })

    it('successバリアントのスタイルが適用される', () => {
      render(<Badge variant="success">成功</Badge>)
      const badge = screen.getByText('成功')
      expect(badge).toHaveClass('bg-family', 'text-family-ink')
    })

    it('warningバリアントのスタイルが適用される', () => {
      render(<Badge variant="warning">警告</Badge>)
      const badge = screen.getByText('警告')
      expect(badge).toHaveClass('bg-once', 'text-once-ink')
    })

    it('dangerバリアントのスタイルが適用される', () => {
      render(<Badge variant="danger">危険</Badge>)
      const badge = screen.getByText('危険')
      expect(badge).toHaveClass('bg-danger-soft', 'text-danger')
    })

    it('infoバリアントのスタイルが適用される', () => {
      render(<Badge variant="info">情報</Badge>)
      const badge = screen.getByText('情報')
      expect(badge).toHaveClass('bg-cycle', 'text-cycle-ink')
    })
  })

  describe('size', () => {
    it('smサイズのスタイルが適用される', () => {
      render(<Badge size="sm">小</Badge>)
      expect(screen.getByText('小')).toHaveClass('px-2', 'py-0.5', 'text-xs')
    })

    it('mdサイズがデフォルトで適用される', () => {
      render(<Badge>中</Badge>)
      expect(screen.getByText('中')).toHaveClass('px-2.5', 'py-1', 'text-sm')
    })
  })

  describe('共通スタイル', () => {
    it('rounded-chipクラスが適用される', () => {
      render(<Badge>テスト</Badge>)
      expect(screen.getByText('テスト')).toHaveClass('rounded-chip')
    })

    it('font-boldクラスが適用される', () => {
      render(<Badge>テスト</Badge>)
      expect(screen.getByText('テスト')).toHaveClass('font-bold')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      render(<Badge className="custom-class">カスタム</Badge>)
      expect(screen.getByText('カスタム')).toHaveClass('custom-class')
    })
  })
})

