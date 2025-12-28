/**
 * PageContainerコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageContainer } from '../PageContainer'

describe('PageContainer', () => {
  describe('レンダリング', () => {
    it('子要素を正しく表示する', () => {
      render(
        <PageContainer>
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByText('コンテンツ')).toBeInTheDocument()
    })

    it('main要素としてレンダリングされる', () => {
      render(
        <PageContainer>
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })

  describe('共通スタイル', () => {
    it('min-h-screenクラスが適用される', () => {
      render(
        <PageContainer>
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByRole('main')).toHaveClass('min-h-screen')
    })

    it('pb-20クラスが適用される（BottomNavの余白）', () => {
      render(
        <PageContainer>
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByRole('main')).toHaveClass('pb-20')
    })

    it('max-w-lgクラスが適用される', () => {
      render(
        <PageContainer>
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByRole('main')).toHaveClass('max-w-lg')
    })
  })

  describe('noPadding', () => {
    it('デフォルトでpx-4クラスが適用される', () => {
      render(
        <PageContainer>
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByRole('main')).toHaveClass('px-4')
    })

    it('noPadding=trueでpx-4クラスが適用されない', () => {
      render(
        <PageContainer noPadding>
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByRole('main')).not.toHaveClass('px-4')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラス名が適用される', () => {
      render(
        <PageContainer className="custom-class">
          <div>コンテンツ</div>
        </PageContainer>
      )
      expect(screen.getByRole('main')).toHaveClass('custom-class')
    })
  })
})

