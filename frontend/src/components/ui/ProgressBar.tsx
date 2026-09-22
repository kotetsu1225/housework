import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 完了数 */
  completed: number
  /** 総数 */
  total: number
  /**
   * - segments: 総数ぶんの区切りを並べる（今日のタスクなど件数が少ないとき）
   * - bar: 1本のバーで割合を出す（メンバーのランキングなど）
   */
  variant?: 'segments' | 'bar'
  /** バーの太さ */
  size?: 'sm' | 'md'
}

/**
 * 進捗バー（frontend/DESIGN.md §5）
 *
 * ホームの「今日の家族タスク 1 / 5」は segments、メンバー一覧は bar を使う。
 * 総数が 12 を超えるときは segments でも bar にフォールバックする。
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, completed, total, variant = 'segments', size = 'md', ...props }, ref) => {
    const safeTotal = Math.max(0, total)
    const safeCompleted = Math.min(Math.max(0, completed), safeTotal)
    const percent = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0
    const height = size === 'sm' ? 'h-1.5' : 'h-2'
    const useSegments = variant === 'segments' && safeTotal > 0 && safeTotal <= 12

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCompleted}
        aria-label={`${safeCompleted} / ${safeTotal} 完了`}
        className={clsx('w-full', className)}
        {...props}
      >
        {useSegments ? (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${safeTotal}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: safeTotal }).map((_, i) => (
              <div
                key={i}
                data-filled={i < safeCompleted ? 'true' : 'false'}
                className={clsx(
                  height,
                  'rounded-full',
                  i < safeCompleted ? 'bg-accent' : 'bg-control'
                )}
              />
            ))}
          </div>
        ) : (
          <div className={clsx(height, 'w-full rounded-full bg-control overflow-hidden')}>
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    )
  }
)

ProgressBar.displayName = 'ProgressBar'
