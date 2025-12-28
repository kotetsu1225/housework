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
      expect(screen.getByText('デフォルト')).toHaveClass('bg-dark-700', 'text-dark-200')
    })

    it('successバリアントのスタイルが適用される', () => {
      render(<Badge variant="success">成功</Badge>)
      const badge = screen.getByText('成功')
      expect(badge).toHaveClass('bg-emerald-500/20', 'text-emerald-400')
    })

    it('warningバリアントのスタイルが適用される', () => {
      render(<Badge variant="warning">警告</Badge>)
      const badge = screen.getByText('警告')
      expect(badge).toHaveClass('bg-amber-500/20', 'text-amber-400')
    })

    it('dangerバリアントのスタイルが適用される', () => {
      render(<Badge variant="danger">危険</Badge>)
      const badge = screen.getByText('危険')
      expect(badge).toHaveClass('bg-red-500/20', 'text-red-400')
    })

    it('infoバリアントのスタイルが適用される', () => {
      render(<Badge variant="info">情報</Badge>)
      const badge = screen.getByText('情報')
      expect(badge).toHaveClass('bg-coral-500/20', 'text-coral-400')
    })
  })

  describe('size', () => {
    it('smサイズのスタイルが適用される', () => {
      render(<Badge size="sm">小</Badge>)
      expect(screen.getByText('小')).toHaveClass('px-2', 'py-0.5', 'text-xs')
    })

    it('mdサイズがデフォルトで適用される', () => {
      render(<Badge>中</Badge>)
      expect(screen.getByText('中')).toHaveClass('px-3', 'py-1', 'text-sm')
    })
  })

  describe('共通スタイル', () => {
    it('rounded-fullクラスが適用される', () => {
      render(<Badge>テスト</Badge>)
      expect(screen.getByText('テスト')).toHaveClass('rounded-full')
    })

    it('font-mediumクラスが適用される', () => {
      render(<Badge>テスト</Badge>)
      expect(screen.getByText('テスト')).toHaveClass('font-medium')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      render(<Badge className="custom-class">カスタム</Badge>)
      expect(screen.getByText('カスタム')).toHaveClass('custom-class')
    })
  })
})

