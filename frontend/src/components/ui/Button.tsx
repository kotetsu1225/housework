import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

/**
 * ボタン（frontend/DESIGN.md §4, §5）
 *
 * - すべてのサイズでタップ領域 44px 以上
 * - 影・グラデーション・拡大アニメーションは使わない
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-1.5 font-bold rounded-[10px] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none'

    const variants = {
      primary: 'bg-accent hover:bg-accent-strong active:bg-accent-strong text-white',
      secondary: 'bg-surface hover:bg-canvas active:bg-canvas text-ink border border-line-strong',
      ghost: 'bg-transparent hover:bg-control active:bg-control text-accent',
      danger: 'bg-danger hover:opacity-90 text-white',
    }

    const sizes = {
      sm: 'min-h-tap px-4 text-sm',
      md: 'min-h-tap h-12 px-5 text-base',
      lg: 'h-[50px] px-6 text-base',
    }

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
