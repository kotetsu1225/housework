import { InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

/**
 * 入力欄（frontend/DESIGN.md §4）
 *
 * 高さ 50px、角丸 10px、枠線 line-strong。フォーカスで accent。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-medium text-ink-soft mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full h-[50px] bg-surface border rounded-[10px] px-3.5 text-base text-ink placeholder:text-placeholder',
            'focus:outline-none focus:ring-1 transition-colors duration-150',
            'disabled:opacity-50',
            error
              ? 'border-danger focus:border-danger focus:ring-danger'
              : 'border-line-strong focus:border-accent focus:ring-accent',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
