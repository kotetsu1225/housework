/**
 * Avatarコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar } from '../Avatar'

describe('Avatar', () => {
  describe('イニシャル表示', () => {
    it('名前の最初の文字をイニシャルとして表示する', () => {
      render(<Avatar name="太郎" />)
      expect(screen.getByText('太')).toBeInTheDocument()
    })

    it('英字名の最初の文字を大文字で表示する', () => {
      render(<Avatar name="taro" />)
      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('既に大文字の場合はそのまま表示する', () => {
      render(<Avatar name="Hanako" />)
      expect(screen.getByText('H')).toBeInTheDocument()
    })
  })

  describe('size', () => {
    it('smサイズのスタイルが適用される', () => {
      render(<Avatar name="太郎" size="sm" />)
      expect(screen.getByText('太')).toHaveClass('w-8', 'h-8', 'text-xs')
    })

    it('mdサイズがデフォルトで適用される', () => {
      render(<Avatar name="太郎" />)
      expect(screen.getByText('太')).toHaveClass('w-10', 'h-10', 'text-sm')
    })

    it('lgサイズのスタイルが適用される', () => {
      render(<Avatar name="太郎" size="lg" />)
      expect(screen.getByText('太')).toHaveClass('w-12', 'h-12', 'text-base')
    })

    it('xlサイズのスタイルが適用される', () => {
      render(<Avatar name="太郎" size="xl" />)
      expect(screen.getByText('太')).toHaveClass('w-16', 'h-16', 'text-xl')
    })
  })

  describe('roleアイコン表示', () => {
    it('roleが指定された場合は役割アイコン画像を表示する', () => {
      render(<Avatar name="父" role="FATHER" />)
      expect(screen.getByRole('img', { name: '父' })).toBeInTheDocument()
    })
  })

  describe('variant', () => {
    it('parentバリアントでcoral系のグラデーションが適用される', () => {
      render(<Avatar name="父" variant="parent" />)
      const avatar = screen.getByText('父')
      expect(avatar).toHaveClass('from-coral-400', 'to-coral-500')
    })

    it('childバリアントがデフォルトで適用される', () => {
      render(<Avatar name="太郎" />)
      const avatar = screen.getByText('太')
      // childバリアントは名前に基づいて色が決まる
      expect(avatar.className).toMatch(/from-/)
      expect(avatar.className).not.toMatch(/from-coral/)
    })
  })

  describe('共通スタイル', () => {
    it('rounded-fullクラスが適用される', () => {
      render(<Avatar name="テスト" />)
      expect(screen.getByText('テ')).toHaveClass('rounded-full')
    })

    it('font-boldクラスが適用される', () => {
      render(<Avatar name="テスト" />)
      expect(screen.getByText('テ')).toHaveClass('font-bold')
    })

    it('text-whiteクラスが適用される', () => {
      render(<Avatar name="テスト" />)
      expect(screen.getByText('テ')).toHaveClass('text-white')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      render(<Avatar name="テスト" className="custom-class" />)
      expect(screen.getByText('テ')).toHaveClass('custom-class')
    })
  })
})

