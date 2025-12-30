import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { ROLE_OPTIONS } from '../../constants'
import type { FamilyRole } from '../../types'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  /** 家族の役割（指定された場合は役割アイコンを優先表示） */
  role?: FamilyRole
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'parent' | 'child'
  /** role指定時に画像表示するか（デフォルト: true） */
  showImage?: boolean
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
  ({ className, name, role, size = 'md', variant = 'child', showImage = true, ...props }, ref) => {
    const sizes = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    }

    const textSizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-xl',
    }

    const icon = role ? ROLE_OPTIONS.find((r) => r.value === role)?.icon : undefined
    const shouldShowImage = showImage && !!icon

    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-full flex items-center justify-center font-bold text-white overflow-hidden',
          `bg-gradient-to-br ${getColorFromName(name, variant === 'parent')}`,
          'shadow-md',
          sizes[size],
          !shouldShowImage && textSizes[size],
          className
        )}
        {...props}
      >
        {shouldShowImage ? (
          <img
            src={icon}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          getInitials(name)
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
