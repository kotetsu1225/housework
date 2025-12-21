import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradient'
  hoverable?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverable = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-dark-800 border border-dark-700',
      glass: 'bg-dark-800/80 backdrop-blur-lg border border-dark-700',
      gradient: 'bg-gradient-to-br from-coral-500/20 to-coral-600/10 border border-coral-500/30',
    }

    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-2xl p-4',
          variants[variant],
          hoverable && 'cursor-pointer hover:scale-[1.02] hover:border-dark-600 transition-all duration-200',
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
    <h3 ref={ref} className={clsx('text-lg font-bold text-white', className)} {...props}>
      {children}
    </h3>
  )
)

CardTitle.displayName = 'CardTitle'

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={clsx('text-dark-300', className)} {...props}>
      {children}
    </div>
  )
)

CardContent.displayName = 'CardContent'
