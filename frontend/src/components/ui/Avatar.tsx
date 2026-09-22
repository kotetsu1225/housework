import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { ROLE_OPTIONS } from '../../constants'
import type { FamilyRole } from '../../types'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  /** 家族の役割（指定された場合は役割アイコンを優先表示） */
  role?: FamilyRole
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'parent' | 'child'
  /** role指定時に画像表示するか（デフォルト: true） */
  showImage?: boolean
}

const getInitials = (name: string): string => {
  return name.charAt(0).toUpperCase()
}

/**
 * アバター
 *
 * 役割のイラスト（public/familyIcons）をそのまま丸く表示する。
 * 画像が無いときはイニシャルを accent（親）／personal-ink（子）の塗りで表示。
 */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, role, size = 'md', variant = 'child', showImage = true, ...props }, ref) => {
    const sizes = {
      xs: 'w-4 h-4',
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    }

    const textSizes = {
      xs: 'text-[8px]',
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
          'rounded-full flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0',
          variant === 'parent' ? 'bg-accent' : 'bg-personal-ink',
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
