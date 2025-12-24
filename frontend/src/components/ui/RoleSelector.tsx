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
 * 4つの役割（父、母、兄弟、姉妹）から選択するUIを提供
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
    <div>
      <label className="block text-sm font-medium text-white/70 mb-2">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => !disabled && onChange(role.value)}
            disabled={disabled}
            className={clsx(
              'p-3 rounded-xl border-2 transition-all duration-200',
              value === role.value
                ? 'border-coral-500 bg-coral-500/10'
                : 'border-dark-700 bg-dark-800 hover:border-dark-600',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex flex-col items-center gap-2">
              <img
                src={role.icon}
                alt={role.label}
                className="w-10 h-10 rounded-full object-cover"
              />
              <span className="text-white font-medium text-sm">{role.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

RoleSelector.displayName = 'RoleSelector'

