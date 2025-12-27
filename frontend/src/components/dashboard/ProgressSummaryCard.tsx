/**
 * 進捗サマリーカードコンポーネント
 *
 * 今日のタスク進捗状況を表示するカード
 */

import { Sparkles } from 'lucide-react'
import { Card } from '../ui/Card'
import { ProgressRing } from '../ui/ProgressRing'

/**
 * ProgressSummaryCardコンポーネントのProps
 */
export interface ProgressSummaryCardProps {
  /** 完了タスク数 */
  completedCount: number
  /** 総タスク数 */
  totalCount: number
  /** カスタムラベル（デフォルト: "今日の進捗"） */
  label?: string
}

/**
 * 進捗サマリーカードコンポーネント
 *
 * Dashboard画面の上部に表示される進捗サマリー
 *
 * @example
 * ```tsx
 * <ProgressSummaryCard
 *   completedCount={3}
 *   totalCount={5}
 * />
 * ```
 */
export function ProgressSummaryCard({
  completedCount,
  totalCount,
  label = '今日の進捗',
}: ProgressSummaryCardProps) {
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const remainingCount = totalCount - completedCount

  return (
    <Card variant="gradient" className="relative overflow-hidden">
      {/* 装飾的な背景エフェクト */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-shazam-500/20 rounded-full blur-3xl" />

      <div className="flex items-center gap-6">
        {/* プログレスリング */}
        <ProgressRing progress={progress} size="lg" />

        {/* テキスト情報 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-shazam-400" />
            <span className="text-sm text-white/60">{label}</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {completedCount} / {totalCount}
          </p>
          <p className="text-sm text-white/50 mt-1">
            {remainingCount > 0
              ? `${remainingCount}件のタスクが残っています`
              : totalCount > 0
                ? 'すべてのタスクが完了しました！'
                : 'タスクはありません'}
          </p>
        </div>
      </div>
    </Card>
  )
}

