import { SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

/**
 * セレクト（Input と同じ高さ 50px・角丸 10px）
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-[13px] font-medium text-ink-soft mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full h-[50px] appearance-none bg-surface border border-line-strong rounded-[10px] pl-3.5 pr-10 text-base text-ink',
              'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-icon-muted" />
        </div>
      </div>
    )
  }
)

Select.displayName = 'Select'

export interface CheckboxProps {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * チェックボックス（行全体が 44px のタップ領域）
 */
export function Checkbox({ id, label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 min-h-tap cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded border-line-strong"
        style={{ accentColor: '#1F7A4D' }}
      />
      <span className="text-[15px] text-ink">{label}</span>
    </label>
  )
}

Checkbox.displayName = 'Checkbox'
