/**
 * スケルトンローダーコンポーネント
 *
 * コンテンツ読み込み中のプレースホルダーを表示する
 */

import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'none'
}

/**
 * 基本のスケルトンコンポーネント
 *
 * @example
 * ```tsx
 * // テキスト行
 * <Skeleton variant="text" width="80%" />
 *
 * // アバター
 * <Skeleton variant="circular" width={48} height={48} />
 *
 * // カード
 * <Skeleton variant="rectangular" height={120} />
 * ```
 */
export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  }

  return (
    <div
      className={clsx(
        'bg-control',
        animation === 'pulse' && 'animate-pulse',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-card',
        className
      )}
      style={style}
      aria-hidden="true"
    />
  )
}

/**
 * タスクカード用スケルトン
 */
export function TaskCardSkeleton() {
  return (
    <div className="bg-surface rounded-card p-3.5">
      <div className="flex items-center gap-3">
        {/* ステータスの輪 */}
        <Skeleton variant="circular" width={28} height={28} />

        <div className="flex-1 min-w-0">
          {/* チップ + タスク名 */}
          <div className="flex items-center gap-2 mb-2">
            <Skeleton variant="rectangular" width={44} height={20} />
            <Skeleton variant="text" width="55%" />
          </div>
          {/* 時刻 */}
          <Skeleton variant="text" width="35%" className="h-3" />
        </div>

        {/* pt */}
        <Skeleton variant="text" width={36} />
      </div>
    </div>
  )
}

/**
 * メンバーカード用スケルトン
 */
export function MemberCardSkeleton() {
  return (
    <div className="bg-surface rounded-xl p-3.5 flex items-center gap-3.5">
      <Skeleton variant="circular" width={28} height={28} />
      {/* アバター */}
      <Skeleton variant="circular" width={56} height={56} />

      <div className="flex-1">
        {/* 名前 */}
        <Skeleton variant="text" width="50%" className="mb-2" />
        {/* 件数 */}
        <Skeleton variant="text" width="70%" className="h-3 mb-2" />
        {/* バー */}
        <Skeleton variant="rectangular" height={6} />
      </div>

      {/* pt */}
      <Skeleton variant="text" width={40} />
    </div>
  )
}

/**
 * 進捗サマリー用スケルトン
 */
export function ProgressSummarySkeleton() {
  return (
    <div className="bg-surface rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width={48} />
      </div>
      <Skeleton variant="rectangular" height={8} />
    </div>
  )
}

/**
 * リスト用スケルトン（複数アイテム）
 */
export function ListSkeleton({
  count = 3,
  ItemSkeleton = TaskCardSkeleton,
}: {
  count?: number
  ItemSkeleton?: React.ComponentType
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ItemSkeleton key={i} />
      ))}
    </div>
  )
}
