/**
 * Registerページのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Register } from '../Register'

const renderRegisterPage = (route = '/register') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<div>ログインページ</div>} />
          <Route path="/" element={<div>ホームページ</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Register', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('レンダリング', () => {
    it('登録フォームが表示される', () => {
      renderRegisterPage()
      expect(screen.getByRole('heading', { name: 'アカウント作成' })).toBeInTheDocument()
      expect(screen.getByLabelText('名前')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
    })

    it('4つの役割選択肢が表示される', () => {
      renderRegisterPage()
      expect(screen.getByText('父')).toBeInTheDocument()
      expect(screen.getByText('母')).toBeInTheDocument()
      expect(screen.getByText('兄弟')).toBeInTheDocument()
      expect(screen.getByText('姉妹')).toBeInTheDocument()
    })

    it('ログインリンクが表示される', () => {
      renderRegisterPage()
      expect(screen.getByText('ログイン')).toBeInTheDocument()
    })
  })

  describe('役割選択', () => {
    it('デフォルトで父が選択されている', () => {
      renderRegisterPage()
      const fatherButton = screen.getByRole('button', { name: /父/ })
      expect(fatherButton).toHaveClass('border-coral-500')
    })

    it('役割を変更できる', async () => {
      renderRegisterPage()
      fireEvent.click(screen.getByRole('button', { name: /母/ }))
      
      await waitFor(() => {
        const motherButton = screen.getByRole('button', { name: /母/ })
        expect(motherButton).toHaveClass('border-coral-500')
      })
    })
  })

  describe('バリデーション', () => {
    it('名前が空の場合エラーが表示される', async () => {
      renderRegisterPage()
      fireEvent.click(screen.getByRole('button', { name: '登録する' }))
      
      await waitFor(() => {
        expect(screen.getByText('名前を入力してください')).toBeInTheDocument()
      })
    })

    it('空白のみの名前でエラーが表示される', async () => {
      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: '登録する' }))
      
      await waitFor(() => {
        expect(screen.getByText('名前を入力してください')).toBeInTheDocument()
      })
    })
  })

  describe('登録処理', () => {
    it('登録成功するとホームに遷移する', async () => {
      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '新規ユーザー' } })
      fireEvent.click(screen.getByRole('button', { name: '登録する' }))
      
      await waitFor(() => {
        expect(screen.getByText('ホームページ')).toBeInTheDocument()
      })
    })

    it('登録後にlocalStorageにユーザーが保存される', async () => {
      renderRegisterPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '新規ユーザー' } })
      fireEvent.click(screen.getByRole('button', { name: /母/ }))
      fireEvent.click(screen.getByRole('button', { name: '登録する' }))
      
      await waitFor(() => {
        const users = JSON.parse(localStorage.getItem('housework_users') || '[]')
        expect(users).toHaveLength(1)
        expect(users[0].name).toBe('新規ユーザー')
        expect(users[0].role).toBe('MOTHER')
      })
    })
  })

  describe('ナビゲーション', () => {
    it('ログインリンクをクリックするとログインページに遷移する', async () => {
      renderRegisterPage()
      fireEvent.click(screen.getByText('ログイン'))
      
      await waitFor(() => {
        expect(screen.getByText('ログインページ')).toBeInTheDocument()
      })
    })
  })
})

