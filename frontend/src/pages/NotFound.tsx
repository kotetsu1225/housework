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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 safe-top safe-bottom">
      <div className="w-full max-w-lg text-center">
        <p className="text-[96px] font-bold leading-none tracking-tight text-line-strong tabular select-none">
          404
        </p>

        <h1 className="mt-6 text-[22px] font-bold text-ink">ページが見つかりません</h1>
        <p className="mt-2 text-[15px] text-ink-muted leading-relaxed">
          お探しのページは存在しないか、移動した可能性があります。
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            ホームへ戻る
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            前のページへ戻る
          </Button>
        </div>
      </div>
    </div>
  )
}
