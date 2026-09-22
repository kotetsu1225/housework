/**
 * Alertコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert } from '../Alert'

describe('Alert', () => {
  describe('レンダリング', () => {
    it('メッセージを正しく表示する', () => {
      render(<Alert>テストメッセージ</Alert>)
      expect(screen.getByText('テストメッセージ')).toBeInTheDocument()
    })

    it('role="alert"が設定される', () => {
      render(<Alert>アラート</Alert>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('variant', () => {
    it('errorバリアントのスタイルが適用される', () => {
      render(<Alert variant="error">エラー</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-danger-soft', 'text-danger')
    })

    it('successバリアントのスタイルが適用される', () => {
      render(<Alert variant="success">成功</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-family', 'text-family-ink')
    })

    it('warningバリアントのスタイルが適用される', () => {
      render(<Alert variant="warning">警告</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-once', 'text-once-ink')
    })

    it('infoバリアントがデフォルトで適用される', () => {
      render(<Alert>情報</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-cycle', 'text-cycle-ink')
    })
  })

  describe('showIcon', () => {
    it('デフォルトでアイコンが表示される', () => {
      render(<Alert>テスト</Alert>)
      const alert = screen.getByRole('alert')
      const svg = alert.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('showIcon=falseでアイコンが非表示になる', () => {
      render(<Alert showIcon={false}>テスト</Alert>)
      const alert = screen.getByRole('alert')
      const svg = alert.querySelector('svg')
      expect(svg).not.toBeInTheDocument()
    })
  })

  describe('共通スタイル', () => {
    it('p-4クラスが適用される', () => {
      render(<Alert>テスト</Alert>)
      expect(screen.getByRole('alert')).toHaveClass('p-4')
    })

    it('rounded-xlクラスが適用される', () => {
      render(<Alert>テスト</Alert>)
      expect(screen.getByRole('alert')).toHaveClass('rounded-xl')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      render(<Alert className="custom-class">カスタム</Alert>)
      expect(screen.getByRole('alert')).toHaveClass('custom-class')
    })
  })
})

