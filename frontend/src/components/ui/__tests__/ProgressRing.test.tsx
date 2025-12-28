/**
 * ProgressRingコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressRing } from '../ProgressRing'

describe('ProgressRing', () => {
  describe('進捗表示', () => {
    it('進捗値が表示される', () => {
      render(<ProgressRing progress={75} />)
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('進捗値が四捨五入される', () => {
      render(<ProgressRing progress={33.7} />)
      expect(screen.getByText('34%')).toBeInTheDocument()
    })

    it('0%が正しく表示される', () => {
      render(<ProgressRing progress={0} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('100%が正しく表示される', () => {
      render(<ProgressRing progress={100} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('値のクランプ', () => {
    it('100を超える値は100にクランプされる', () => {
      render(<ProgressRing progress={150} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('0未満の値は0にクランプされる', () => {
      render(<ProgressRing progress={-50} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('size', () => {
    it('smサイズのスタイルが適用される', () => {
      const { container } = render(<ProgressRing progress={50} size="sm" />)
      const ring = container.firstChild
      expect(ring).toHaveClass('w-16', 'h-16')
    })

    it('mdサイズがデフォルトで適用される', () => {
      const { container } = render(<ProgressRing progress={50} />)
      const ring = container.firstChild
      expect(ring).toHaveClass('w-24', 'h-24')
    })

    it('lgサイズのスタイルが適用される', () => {
      const { container } = render(<ProgressRing progress={50} size="lg" />)
      const ring = container.firstChild
      expect(ring).toHaveClass('w-32', 'h-32')
    })
  })

  describe('showValue', () => {
    it('デフォルトで値が表示される', () => {
      render(<ProgressRing progress={50} />)
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('showValue=falseで値が非表示になる', () => {
      render(<ProgressRing progress={50} showValue={false} />)
      expect(screen.queryByText('50%')).not.toBeInTheDocument()
    })
  })

  describe('SVG要素', () => {
    it('SVG要素がレンダリングされる', () => {
      const { container } = render(<ProgressRing progress={50} />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('背景の円がレンダリングされる', () => {
      const { container } = render(<ProgressRing progress={50} />)
      const circles = container.querySelectorAll('circle')
      expect(circles.length).toBeGreaterThanOrEqual(2)
    })

    it('グラデーションが定義される', () => {
      const { container } = render(<ProgressRing progress={50} />)
      const gradient = container.querySelector('#progressGradient')
      expect(gradient).toBeInTheDocument()
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      const { container } = render(
        <ProgressRing progress={50} className="custom-class" />
      )
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})

