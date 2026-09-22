/**
 * グローバルエラーバウンダリ
 *
 * Reactコンポーネントツリー内で発生した予期しないエラーをキャッチし、
 * フォールバックUIを表示する
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * エラー発生時に表示するフォールバックUI
 */
function ErrorFallback({
  error,
  onReset,
}: {
  error: Error | null
  onReset: () => void
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl p-6 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-once rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-danger"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">
          エラーが発生しました
        </h2>
        <p className="text-ink-muted mb-4">
          申し訳ありません。予期しないエラーが発生しました。
        </p>
        {error && (
          <details className="text-left mb-4">
            <summary className="text-sm text-ink-muted cursor-pointer">
              エラー詳細
            </summary>
            <pre className="mt-2 p-3 bg-canvas rounded-lg text-xs text-danger overflow-auto max-h-32 text-left">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => window.location.reload()}
          >
            ページを再読み込み
          </Button>
          <Button variant="primary" className="flex-1" onClick={onReset}>
            再試行
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * エラーバウンダリコンポーネント
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // エラーログを記録（将来的にはログサービスに送信）
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      )
    }

    return this.props.children
  }
}
