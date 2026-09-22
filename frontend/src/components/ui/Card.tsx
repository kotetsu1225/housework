import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * - default: 白い面（箱・単体カード）
   * - family / personal: 家族／個人タスクのカード色（箱の中で使う）
   * - glass / gradient: 旧デザインの互換用。default と同じ見た目
   */
  variant?: 'default' | 'family' | 'personal' | 'glass' | 'gradient'
  hoverable?: boolean
}

/**
 * カード（frontend/DESIGN.md §4）
 *
 * 影・枠線・グラデーションは使わず、背景色の差だけで面を作る。
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverable = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-surface',
      glass: 'bg-surface',
      gradient: 'bg-surface',
      family: 'bg-family',
      personal: 'bg-personal',
    }

    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-xl p-4',
          variants[variant],
          hoverable && 'cursor-pointer active:bg-canvas transition-colors duration-150',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={clsx('mb-3', className)} {...props}>
      {children}
    </div>
  )
)

CardHeader.displayName = 'CardHeader'

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={clsx('text-[15px] font-bold text-ink', className)} {...props}>
      {children}
    </h3>
  )
)

CardTitle.displayName = 'CardTitle'

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={clsx('text-ink-muted', className)} {...props}>
      {children}
    </div>
  )
)

CardContent.displayName = 'CardContent'

export interface SectionBoxProps extends HTMLAttributes<HTMLElement> {
  /** 箱のタイトル（例: 家族のタスク） */
  title: string
  /** 右端の補足（例: 残り 4 件） */
  meta?: string
}

/**
 * 家族のタスク／自分のタスクのような「大きな箱」（frontend/DESIGN.md §4）
 *
 * 白い面にタイトル行を持ち、中に family / personal のカードを並べる。
 */
export const SectionBox = forwardRef<HTMLElement, SectionBoxProps>(
  ({ className, title, meta, children, ...props }, ref) => (
    <section
      ref={ref}
      className={clsx('bg-surface rounded-box p-3 flex flex-col gap-2', className)}
      {...props}
    >
      <div className="flex items-baseline justify-between px-1 pt-0.5 pb-1">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {meta && <span className="text-[13px] text-ink-muted tabular">{meta}</span>}
      </div>
      {children}
    </section>
  )
)

SectionBox.displayName = 'SectionBox'
