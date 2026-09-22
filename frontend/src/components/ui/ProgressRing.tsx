import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface ProgressRingProps extends HTMLAttributes<HTMLDivElement> {
  progress: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
}

/**
 * 円形の進捗（単色。グラデーションは使わない）
 *
 * 新デザインでは ProgressBar を優先し、ProgressRing はランキングなど円が
 * 意味を持つ場所だけで使う。
 */
export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(
  ({ className, progress, size = 'md', showValue = true, ...props }, ref) => {
    const clampedProgress = Math.min(100, Math.max(0, progress))

    const sizes = {
      sm: { container: 'w-16 h-16', stroke: 6, radius: 42, text: 'text-sm' },
      md: { container: 'w-24 h-24', stroke: 7, radius: 42, text: 'text-lg' },
      lg: { container: 'w-32 h-32', stroke: 8, radius: 42, text: 'text-2xl' },
    }

    const { container, stroke, radius, text } = sizes[size]
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (clampedProgress / 100) * circumference

    return (
      <div
        ref={ref}
        className={clsx('relative', container, className)}
        role="img"
        aria-label={`進捗 ${Math.round(clampedProgress)}%`}
        {...props}
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-control"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-accent transition-all duration-500 ease-out"
          />
        </svg>
        {showValue && (
          <div className={clsx('absolute inset-0 flex items-center justify-center font-bold text-ink tabular', text)}>
            {Math.round(clampedProgress)}%
          </div>
        )}
      </div>
    )
  }
)

ProgressRing.displayName = 'ProgressRing'
