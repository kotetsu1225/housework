import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface ProgressRingProps extends HTMLAttributes<HTMLDivElement> {
  progress: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
}

export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(
  ({ className, progress, size = 'md', showValue = true, ...props }, ref) => {
    const clampedProgress = Math.min(100, Math.max(0, progress))

    const sizes = {
      sm: { container: 'w-16 h-16', stroke: 4, radius: 28, text: 'text-sm' },
      md: { container: 'w-24 h-24', stroke: 6, radius: 42, text: 'text-lg' },
      lg: { container: 'w-32 h-32', stroke: 8, radius: 56, text: 'text-2xl' },
    }

    const { container, stroke, radius, text } = sizes[size]
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (clampedProgress / 100) * circumference

    return (
      <div
        ref={ref}
        className={clsx('relative', container, className)}
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
            className="text-white/10"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0084ff" />
              <stop offset="100%" stopColor="#00d4ff" />
            </linearGradient>
          </defs>
        </svg>
        {showValue && (
          <div className={clsx('absolute inset-0 flex items-center justify-center font-bold text-white', text)}>
            {Math.round(clampedProgress)}%
          </div>
        )}
      </div>
    )
  }
)

ProgressRing.displayName = 'ProgressRing'
