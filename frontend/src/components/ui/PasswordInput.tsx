import { InputHTMLAttributes, forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input'

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
}

/**
 * パスワード入力欄
 *
 * Input の右端に 44px の表示／非表示ボタンを重ねる（frontend/DESIGN.md §4）。
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={className ? `pr-14 ${className}` : 'pr-14'}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? 'パスワードを隠す' : 'パスワードを表示'}
          aria-pressed={visible}
          className="absolute right-[3px] bottom-[3px] w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted disabled:opacity-50"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'
