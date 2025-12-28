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
  animation?: 'pulse' | 'wave' | 'none'
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
        'bg-dark-700',
        animation === 'pulse' && 'animate-pulse',
        animation === 'wave' && 'animate-shimmer',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-xl',
        className
      )}
      style={style}
    />
  )
}

/**
 * タスクカード用スケルトン
 */
export function TaskCardSkeleton() {
  return (
    <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        {/* ステータスアイコン */}
        <Skeleton variant="circular" width={40} height={40} />

        <div className="flex-1 min-w-0">
          {/* タスク名 */}
          <Skeleton variant="text" width="70%" className="mb-2" />
          {/* 説明 */}
          <Skeleton variant="text" width="50%" className="h-3 mb-3" />
          {/* バッジ */}
          <div className="flex gap-2">
            <Skeleton variant="rectangular" width={60} height={20} />
            <Skeleton variant="rectangular" width={48} height={20} />
          </div>
        </div>

        {/* 担当者アバター */}
        <Skeleton variant="circular" width={32} height={32} />
      </div>
    </div>
  )
}

/**
 * メンバーカード用スケルトン
 */
export function MemberCardSkeleton() {
  return (
    <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-4 flex items-center gap-4">
      {/* アバター */}
      <Skeleton variant="circular" width={56} height={56} />

      <div className="flex-1">
        {/* 名前 */}
        <Skeleton variant="text" width="60%" className="mb-2" />
        {/* 役割 */}
        <Skeleton variant="text" width="40%" className="h-3" />
      </div>

      {/* 統計 */}
      <div className="text-right">
        <Skeleton variant="text" width={48} className="mb-1" />
        <Skeleton variant="text" width={32} className="h-3" />
      </div>
    </div>
  )
}

/**
 * 進捗サマリー用スケルトン
 */
export function ProgressSummarySkeleton() {
  return (
    <div className="bg-gradient-to-br from-dark-800/80 to-dark-900/80 border border-dark-700 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton variant="text" width="40%" className="mb-3" />
          <Skeleton variant="text" width="60%" className="h-8 mb-2" />
          <Skeleton variant="text" width="30%" className="h-3" />
        </div>
        <Skeleton variant="circular" width={80} height={80} />
      </div>
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
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ItemSkeleton key={i} />
      ))}
    </div>
  )
}
