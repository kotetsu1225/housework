import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * - recurring / info: 定期の周期チップ（毎日、毎週火曜）
   * - onetime / warning: 単発の期日チップ（9/22）
   * - success: 完了などの肯定的な状態
   * - danger: 注意
   * - personal: 個人タスク
   * - default: それ以外
   */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'recurring' | 'onetime' | 'personal'
  size?: 'sm' | 'md'
}

/**
 * チップ（frontend/DESIGN.md §2, §4）
 *
 * 角丸 6px、塗りと文字色の組み合わせは DESIGN.md のトークンのみ。
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-control text-ink-soft',
      success: 'bg-family text-family-ink',
      warning: 'bg-once text-once-ink',
      danger: 'bg-danger-soft text-danger',
      info: 'bg-cycle text-cycle-ink',
      recurring: 'bg-cycle text-cycle-ink',
      onetime: 'bg-once text-once-ink',
      personal: 'bg-personal-chip text-personal-ink',
    }

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    }

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center font-bold rounded-chip whitespace-nowrap tabular',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'
