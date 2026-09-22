/**
 * 進捗サマリーカードコンポーネント
 *
 * 今日のタスク進捗状況を表示するカード（frontend/DESIGN.md §5）
 */

import { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'

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
  /** カード下部の行（明日のタスクへのリンクなど） */
  footer?: ReactNode
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
  footer,
}: ProgressSummaryCardProps) {
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const remainingCount = totalCount - completedCount

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium text-ink">{label}</span>
          <span className="text-[17px] font-bold text-ink tabular">
            {completedCount} / {totalCount}
          </span>
        </div>

        <ProgressBar completed={completedCount} total={totalCount} />

        <div className="flex items-baseline justify-between gap-3 text-[13px] text-ink-muted tabular">
          <span>
            {remainingCount > 0
              ? `${remainingCount}件のタスクが残っています`
              : totalCount > 0
                ? 'すべてのタスクが完了しました！'
                : 'タスクはありません'}
          </span>
          <span>{progress}%</span>
        </div>
      </div>

      {footer && <div className="border-t border-line">{footer}</div>}
    </Card>
  )
}
