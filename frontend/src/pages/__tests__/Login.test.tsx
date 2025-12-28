/**
 * Loginページのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../contexts/AuthContext'
import { Login } from '../Login'

const renderLoginPage = (route = '/login') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<div>新規登録ページ</div>} />
          <Route path="/" element={<div>ホームページ</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('レンダリング', () => {
    it('ログインフォームが表示される', () => {
      renderLoginPage()
      // 見出しを確認（複数あるので getAllByRole を使用）
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
      expect(screen.getByLabelText('名前')).toBeInTheDocument()
    })

    it('新規登録リンクが表示される', () => {
      renderLoginPage()
      expect(screen.getByText('新規登録')).toBeInTheDocument()
    })
  })

  describe('バリデーション', () => {
    it('名前が空の場合エラーが表示される', async () => {
      renderLoginPage()
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
      
      await waitFor(() => {
        expect(screen.getByText('名前を入力してください')).toBeInTheDocument()
      })
    })

    it('空白のみの名前でエラーが表示される', async () => {
      renderLoginPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
      
      await waitFor(() => {
        expect(screen.getByText('名前を入力してください')).toBeInTheDocument()
      })
    })
  })

  describe('ログイン処理', () => {
    it('存在しないユーザーでログインするとエラーが表示される', async () => {
      renderLoginPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: '存在しないユーザー' } })
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
      
      await waitFor(() => {
        expect(screen.getByText('ユーザーが見つかりませんでした')).toBeInTheDocument()
      })
    })

    it('存在するユーザーでログインするとホームに遷移する', async () => {
      // ユーザーを事前登録
      const user = {
        id: 'test-user',
        name: 'テストユーザー',
        role: 'FATHER',
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('housework_users', JSON.stringify([user]))

      renderLoginPage()
      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'テストユーザー' } })
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
      
      await waitFor(() => {
        expect(screen.getByText('ホームページ')).toBeInTheDocument()
      })
    })
  })

  describe('ナビゲーション', () => {
    it('新規登録リンクをクリックすると登録ページに遷移する', async () => {
      renderLoginPage()
      fireEvent.click(screen.getByText('新規登録'))
      
      await waitFor(() => {
        expect(screen.getByText('新規登録ページ')).toBeInTheDocument()
      })
    })
  })
})

