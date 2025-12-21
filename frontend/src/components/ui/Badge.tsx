import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-dark-700 text-dark-200',
      success: 'bg-emerald-500/20 text-emerald-400',
      warning: 'bg-amber-500/20 text-amber-400',
      danger: 'bg-red-500/20 text-red-400',
      info: 'bg-coral-500/20 text-coral-400',
    }

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
    }

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center font-medium rounded-full',
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
