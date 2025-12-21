import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'parent' | 'child'
}

const getInitials = (name: string): string => {
  return name.charAt(0).toUpperCase()
}

const getColorFromName = (name: string, isParent: boolean): string => {
  if (isParent) {
    return 'from-coral-400 to-coral-500'
  }
  const colors = [
    'from-accent-blue to-blue-400',
    'from-accent-green to-emerald-400',
    'from-amber-400 to-orange-400',
    'from-violet-400 to-purple-400',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, size = 'md', variant = 'child', ...props }, ref) => {
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-xl',
    }

    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-full flex items-center justify-center font-bold text-white',
          `bg-gradient-to-br ${getColorFromName(name, variant === 'parent')}`,
          'shadow-md',
          sizes[size],
          className
        )}
        {...props}
      >
        {getInitials(name)}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
