/**
 * 404 Not Found ページ
 *
 * 存在しないURLにアクセスした際に表示する
 */

import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/Button'

/**
 * 404ページコンポーネント
 *
 * @example
 * ```tsx
 * // App.tsx のルート設定
 * <Route path="*" element={<NotFound />} />
 * ```
 */
export function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* 404 アイコン */}
        <div className="relative mb-8">
          <div className="text-[120px] md:text-[160px] font-bold text-dark-800 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-coral-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-coral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* メッセージ */}
        <h1 className="text-2xl font-bold text-white mb-2">
          ページが見つかりません
        </h1>
        <p className="text-white/60 mb-8">
          お探しのページは存在しないか、移動した可能性があります。
        </p>

        {/* アクションボタン */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            前のページへ戻る
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            ホームへ戻る
          </Button>
        </div>
      </div>
    </div>
  )
}
