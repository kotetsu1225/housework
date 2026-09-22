import { clsx } from 'clsx'
import type { FamilyRole } from '../../types'
import { ROLE_OPTIONS } from '../../constants'

export interface RoleSelectorProps {
  /** 選択中の役割 */
  value: FamilyRole
  /** 役割変更時のコールバック */
  onChange: (role: FamilyRole) => void
  /** ラベル */
  label?: string
  /** 無効状態 */
  disabled?: boolean
}

/**
 * 役割選択コンポーネント
 *
 * 4つの役割（父、母、兄、妹）を横一列のタイルから選ぶ。
 * 選択中は accent の枠と family の塗り。
 *
 * @example
 * ```tsx
 * <RoleSelector
 *   value={selectedRole}
 *   onChange={setSelectedRole}
 *   label="役割"
 * />
 * ```
 */
export function RoleSelector({
  value,
  onChange,
  label = '役割',
  disabled = false,
}: RoleSelectorProps) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="block text-[13px] font-medium text-ink-soft mb-2">
        {label}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {ROLE_OPTIONS.map((role) => {
          const selected = value === role.value
          return (
            <button
              key={role.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => !disabled && onChange(role.value)}
              disabled={disabled}
              className={clsx(
                'py-2.5 px-1 min-h-tap rounded-xl border-2 transition-colors duration-150',
                selected
                  ? 'border-accent bg-family'
                  : 'border-line bg-surface',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex flex-col items-center gap-1.5">
                <img
                  src={role.icon}
                  alt={role.label}
                  className="w-[52px] h-[52px] rounded-full object-cover"
                />
                <span
                  className={clsx(
                    'text-[13px]',
                    selected ? 'font-bold text-family-ink' : 'font-medium text-ink-soft'
                  )}
                >
                  {role.label}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

RoleSelector.displayName = 'RoleSelector'
