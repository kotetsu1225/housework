/**
 * Inputコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../Input'

describe('Input', () => {
  describe('レンダリング', () => {
    it('input要素がレンダリングされる', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('placeholderが表示される', () => {
      render(<Input placeholder="入力してください" />)
      expect(screen.getByPlaceholderText('入力してください')).toBeInTheDocument()
    })
  })

  describe('label', () => {
    it('labelが表示される', () => {
      render(<Input label="名前" />)
      expect(screen.getByText('名前')).toBeInTheDocument()
    })

    it('labelとinputが関連付けられる', () => {
      render(<Input label="メール" />)
      const input = screen.getByLabelText('メール')
      expect(input).toBeInTheDocument()
    })

    it('labelからidが自動生成される', () => {
      render(<Input label="パスワード" />)
      const input = screen.getByLabelText('パスワード')
      expect(input).toHaveAttribute('id', 'パスワード')
    })

    it('カスタムidが優先される', () => {
      render(<Input label="テスト" id="custom-id" />)
      const input = screen.getByLabelText('テスト')
      expect(input).toHaveAttribute('id', 'custom-id')
    })
  })

  describe('error', () => {
    it('エラーメッセージが表示される', () => {
      render(<Input error="入力必須です" />)
      expect(screen.getByText('入力必須です')).toBeInTheDocument()
    })

    it('エラー時にborder-red-500クラスが適用される', () => {
      render(<Input error="エラー" />)
      expect(screen.getByRole('textbox')).toHaveClass('border-red-500')
    })

    it('エラーがない場合はborder-dark-700クラスが適用される', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toHaveClass('border-dark-700')
    })
  })

  describe('入力イベント', () => {
    it('onChangeハンドラが呼ばれる', () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'テスト' } })
      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('入力値が反映される', () => {
      render(<Input defaultValue="初期値" />)
      expect(screen.getByRole('textbox')).toHaveValue('初期値')
    })
  })

  describe('disabled状態', () => {
    it('disabledプロパティで入力が無効化される', () => {
      render(<Input disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })

  describe('type', () => {
    it('typeプロパティが適用される', () => {
      render(<Input type="email" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
    })

    it('passwordタイプが適用される', () => {
      render(<Input type="password" />)
      const input = document.querySelector('input[type="password"]')
      expect(input).toBeInTheDocument()
    })
  })

  describe('共通スタイル', () => {
    it('w-fullクラスが適用される', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toHaveClass('w-full')
    })

    it('rounded-xlクラスが適用される', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toHaveClass('rounded-xl')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      render(<Input className="custom-class" />)
      expect(screen.getByRole('textbox')).toHaveClass('custom-class')
    })
  })
})

