/**
 * Modalコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '../Modal'

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'テストモーダル',
    children: <div>モーダルの内容</div>,
  }

  describe('レンダリング', () => {
    it('isOpen=trueの場合モーダルが表示される', () => {
      render(<Modal {...defaultProps} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('テストモーダル')).toBeInTheDocument()
      expect(screen.getByText('モーダルの内容')).toBeInTheDocument()
    })

    it('isOpen=falseの場合モーダルが表示されない', () => {
      render(<Modal {...defaultProps} isOpen={false} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('タイトルが表示される', () => {
      render(<Modal {...defaultProps} title="カスタムタイトル" />)
      expect(screen.getByText('カスタムタイトル')).toBeInTheDocument()
    })
  })

  describe('閉じるボタン', () => {
    it('デフォルトで閉じるボタンが表示される', () => {
      render(<Modal {...defaultProps} />)
      expect(screen.getByLabelText('閉じる')).toBeInTheDocument()
    })

    it('showCloseButton=falseで閉じるボタンが非表示になる', () => {
      render(<Modal {...defaultProps} showCloseButton={false} />)
      expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument()
    })

    it('閉じるボタンクリックでonCloseが呼ばれる', () => {
      const onClose = vi.fn()
      render(<Modal {...defaultProps} onClose={onClose} />)
      fireEvent.click(screen.getByLabelText('閉じる'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('オーバーレイクリック', () => {
    it('closeOnOverlayClick=falseの場合オーバーレイクリックで閉じない', () => {
      const onClose = vi.fn()
      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false} />)
      fireEvent.click(screen.getByRole('dialog'))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('closeOnOverlayClick=trueの場合オーバーレイクリックで閉じる', () => {
      const onClose = vi.fn()
      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={true} />)
      // オーバーレイ部分（dialog要素自体）をクリック
      const dialog = screen.getByRole('dialog')
      fireEvent.click(dialog)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('モーダル内クリックでは閉じない', () => {
      const onClose = vi.fn()
      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={true} />)
      fireEvent.click(screen.getByText('モーダルの内容'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('ESCキー', () => {
    it('ESCキーでonCloseが呼ばれる', () => {
      const onClose = vi.fn()
      render(<Modal {...defaultProps} onClose={onClose} />)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('footer', () => {
    it('footerが表示される', () => {
      render(
        <Modal
          {...defaultProps}
          footer={<button>保存</button>}
        />
      )
      expect(screen.getByText('保存')).toBeInTheDocument()
    })

    it('footerがない場合はフッター領域が表示されない', () => {
      render(<Modal {...defaultProps} />)
      const dialog = screen.getByRole('dialog')
      // mt-8クラスを持つ要素がないことを確認
      const footer = dialog.querySelector('.mt-8')
      expect(footer).not.toBeInTheDocument()
    })
  })

  describe('アクセシビリティ', () => {
    it('aria-modal="true"が設定される', () => {
      render(<Modal {...defaultProps} />)
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('aria-labelledbyでタイトルに関連付けられる', () => {
      render(<Modal {...defaultProps} />)
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title')
    })
  })
})

