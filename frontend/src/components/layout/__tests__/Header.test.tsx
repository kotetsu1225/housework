/**
 * Headerコンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { Header } from '../Header'

// react-router-domのuseNavigateをモック
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
  }
})

const renderWithRouter = (ui: React.ReactElement, { route = '/' } = {}) => {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

describe('Header', () => {
  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(vi.fn())
  })

  describe('レンダリング', () => {
    it('タイトルが表示される', () => {
      renderWithRouter(<Header title="テストタイトル" />)
      expect(screen.getByRole('heading', { name: 'テストタイトル' })).toBeInTheDocument()
    })

    it('サブタイトルが表示される', () => {
      renderWithRouter(<Header title="タイトル" subtitle="サブタイトル" />)
      expect(screen.getByText('サブタイトル')).toBeInTheDocument()
    })

    it('サブタイトルがない場合は表示されない', () => {
      renderWithRouter(<Header title="タイトル" />)
      expect(screen.queryByText('サブタイトル')).not.toBeInTheDocument()
    })
  })

  describe('showBack', () => {
    it('showBack=trueで戻るボタンが表示される', () => {
      renderWithRouter(<Header title="タイトル" showBack />)
      const backButton = screen.getByRole('button')
      expect(backButton).toBeInTheDocument()
    })

    it('showBack=falseで戻るボタンが表示されない', () => {
      renderWithRouter(<Header title="タイトル" showBack={false} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('戻るボタンクリックでnavigate(-1)が呼ばれる', () => {
      const navigate = vi.fn()
      vi.mocked(useNavigate).mockReturnValue(navigate)

      renderWithRouter(<Header title="タイトル" showBack />)
      fireEvent.click(screen.getByRole('button'))
      expect(navigate).toHaveBeenCalledWith(-1)
    })
  })

  describe('action', () => {
    it('actionが表示される', () => {
      renderWithRouter(
        <Header title="タイトル" action={<button>アクション</button>} />
      )
      expect(screen.getByRole('button', { name: 'アクション' })).toBeInTheDocument()
    })
  })

  describe('transparent', () => {
    it('transparent=trueでbg-transparentクラスが適用される', () => {
      const { container } = renderWithRouter(<Header title="タイトル" transparent />)
      const header = container.querySelector('header')
      expect(header).toHaveClass('bg-transparent')
    })

    it('transparent=falseでbackdrop-blur-lgクラスが適用される', () => {
      const { container } = renderWithRouter(<Header title="タイトル" transparent={false} />)
      const header = container.querySelector('header')
      expect(header).toHaveClass('backdrop-blur-lg')
    })
  })
})

