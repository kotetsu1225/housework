/**
 * Buttonコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
  describe('レンダリング', () => {
    it('子要素を正しく表示する', () => {
      render(<Button>クリック</Button>)
      expect(screen.getByRole('button', { name: 'クリック' })).toBeInTheDocument()
    })

    it('デフォルトでprimaryバリアントが適用される', () => {
      render(<Button>テスト</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-coral-500')
    })
  })

  describe('variant', () => {
    it('secondaryバリアントのスタイルが適用される', () => {
      render(<Button variant="secondary">セカンダリ</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-dark-700')
    })

    it('ghostバリアントのスタイルが適用される', () => {
      render(<Button variant="ghost">ゴースト</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-transparent')
    })

    it('dangerバリアントのスタイルが適用される', () => {
      render(<Button variant="danger">削除</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-red-500')
    })
  })

  describe('size', () => {
    it('smサイズのスタイルが適用される', () => {
      render(<Button size="sm">小</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('py-2', 'px-4', 'text-sm')
    })

    it('mdサイズがデフォルトで適用される', () => {
      render(<Button>中</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('py-3', 'px-6', 'text-base')
    })

    it('lgサイズのスタイルが適用される', () => {
      render(<Button size="lg">大</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('py-4', 'px-8', 'text-lg')
    })
  })

  describe('loading状態', () => {
    it('loading時にスピナーが表示される', () => {
      render(<Button loading>読み込み中</Button>)
      const button = screen.getByRole('button')
      const spinner = button.querySelector('svg')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('animate-spin')
    })

    it('loading時にボタンがdisabledになる', () => {
      render(<Button loading>読み込み中</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('disabled状態', () => {
    it('disabledプロパティでボタンが無効化される', () => {
      render(<Button disabled>無効</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('disabled時にopacity-50クラスが適用される', () => {
      render(<Button disabled>無効</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('disabled:opacity-50')
    })
  })

  describe('クリックイベント', () => {
    it('クリック時にonClickハンドラが呼ばれる', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>クリック</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('disabled時にonClickハンドラが呼ばれない', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick} disabled>無効</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      render(<Button className="custom-class">カスタム</Button>)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })
})

