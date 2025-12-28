/**
 * テストユーティリティ
 *
 * カスタムrender関数とテストヘルパーを提供
 * @see https://testing-library.com/docs/react-testing-library/setup#custom-render
 */

import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'

/**
 * カスタムrender用のオプション
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** 初期ルート */
  route?: string
  /** ルーティング設定（複数ルート対応） */
  routerConfig?: {
    path: string
    element: ReactElement
  }[]
}

/**
 * 全プロバイダーをラップするコンポーネント
 */
function AllProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

/**
 * プロバイダー付きrender関数
 *
 * AuthProviderをラップした状態でコンポーネントをレンダリング
 *
 * @example
 * ```tsx
 * const { getByText } = renderWithProviders(<MyComponent />)
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { route = '/', routerConfig, ...renderOptions } = options || {}

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        {routerConfig ? (
          <Routes>
            {routerConfig.map((config) => (
              <Route key={config.path} path={config.path} element={config.element} />
            ))}
            <Route path="*" element={children} />
          </Routes>
        ) : (
          children
        )}
      </AuthProvider>
    </MemoryRouter>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/**
 * シンプルなrender関数（プロバイダーなし）
 *
 * UIコンポーネントなどプロバイダーが不要なテスト用
 */
export function renderSimple(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options)
}

/**
 * ルーター付きrender関数（認証なし）
 *
 * ルーティングのみが必要なテスト用
 */
export function renderWithRouter(
  ui: ReactElement,
  options?: { route?: string } & RenderOptions
) {
  const { route = '/', ...renderOptions } = options || {}

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/**
 * localStorage操作用ヘルパー
 */
export const localStorageHelper = {
  /**
   * テスト用にlocalStorageをクリア
   */
  clear: () => {
    localStorage.clear()
  },

  /**
   * 認証ユーザーをセットアップ
   */
  setupAuthUser: (user: {
    id: string
    name: string
    role: 'FATHER' | 'MOTHER' | 'BROTHER' | 'SISTER'
  }) => {
    const users = [{ ...user, createdAt: new Date().toISOString() }]
    localStorage.setItem('housework_users', JSON.stringify(users))
    localStorage.setItem(
      'housework_currentUser',
      JSON.stringify({ ...user, createdAt: new Date().toISOString() })
    )
  },

  /**
   * ユーザー一覧をセットアップ
   */
  setupUsers: (
    users: Array<{
      id: string
      name: string
      role: 'FATHER' | 'MOTHER' | 'BROTHER' | 'SISTER'
    }>
  ) => {
    const usersWithTimestamp = users.map((u) => ({
      ...u,
      createdAt: new Date().toISOString(),
    }))
    localStorage.setItem('housework_users', JSON.stringify(usersWithTimestamp))
  },
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'

