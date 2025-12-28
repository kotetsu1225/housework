/**
 * RoleSelectorコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoleSelector } from '../RoleSelector'

describe('RoleSelector', () => {
  const defaultProps = {
    value: 'FATHER' as const,
    onChange: vi.fn(),
  }

  describe('レンダリング', () => {
    it('4つの役割オプションが表示される', () => {
      render(<RoleSelector {...defaultProps} />)
      expect(screen.getByText('父')).toBeInTheDocument()
      expect(screen.getByText('母')).toBeInTheDocument()
      expect(screen.getByText('兄弟')).toBeInTheDocument()
      expect(screen.getByText('姉妹')).toBeInTheDocument()
    })

    it('デフォルトラベル"役割"が表示される', () => {
      render(<RoleSelector {...defaultProps} />)
      expect(screen.getByText('役割')).toBeInTheDocument()
    })

    it('カスタムラベルが表示される', () => {
      render(<RoleSelector {...defaultProps} label="メンバーの役割" />)
      expect(screen.getByText('メンバーの役割')).toBeInTheDocument()
    })
  })

  describe('選択状態', () => {
    it('選択中の役割にcoral系のスタイルが適用される', () => {
      render(<RoleSelector {...defaultProps} value="FATHER" />)
      const fatherButton = screen.getByRole('button', { name: /父/ })
      expect(fatherButton).toHaveClass('border-coral-500', 'bg-coral-500/10')
    })

    it('非選択の役割にdark系のスタイルが適用される', () => {
      render(<RoleSelector {...defaultProps} value="FATHER" />)
      const motherButton = screen.getByRole('button', { name: /母/ })
      expect(motherButton).toHaveClass('border-dark-700', 'bg-dark-800')
    })
  })

  describe('役割変更', () => {
    it('クリックでonChangeが呼ばれる', () => {
      const onChange = vi.fn()
      render(<RoleSelector {...defaultProps} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /母/ }))
      expect(onChange).toHaveBeenCalledWith('MOTHER')
    })

    it('兄弟をクリックするとBROTHERが渡される', () => {
      const onChange = vi.fn()
      render(<RoleSelector {...defaultProps} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /兄弟/ }))
      expect(onChange).toHaveBeenCalledWith('BROTHER')
    })

    it('姉妹をクリックするとSISTERが渡される', () => {
      const onChange = vi.fn()
      render(<RoleSelector {...defaultProps} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /姉妹/ }))
      expect(onChange).toHaveBeenCalledWith('SISTER')
    })
  })

  describe('disabled状態', () => {
    it('disabled時にopacity-50クラスが適用される', () => {
      render(<RoleSelector {...defaultProps} disabled />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toHaveClass('opacity-50')
      })
    })

    it('disabled時にボタンがdisabledになる', () => {
      render(<RoleSelector {...defaultProps} disabled />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })

    it('disabled時にonChangeが呼ばれない', () => {
      const onChange = vi.fn()
      render(<RoleSelector {...defaultProps} onChange={onChange} disabled />)
      fireEvent.click(screen.getByRole('button', { name: /母/ }))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('アイコン表示', () => {
    it('各役割のアイコン画像が表示される', () => {
      render(<RoleSelector {...defaultProps} />)
      const images = screen.getAllByRole('img')
      expect(images).toHaveLength(4)
    })

    it('アイコン画像にalt属性が設定される', () => {
      render(<RoleSelector {...defaultProps} />)
      expect(screen.getByAltText('父')).toBeInTheDocument()
      expect(screen.getByAltText('母')).toBeInTheDocument()
      expect(screen.getByAltText('兄弟')).toBeInTheDocument()
      expect(screen.getByAltText('姉妹')).toBeInTheDocument()
    })
  })
})

