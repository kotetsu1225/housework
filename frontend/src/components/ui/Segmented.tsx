import { clsx } from 'clsx'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** アクセシビリティ用の名前 */
  label: string
  disabled?: boolean
  className?: string
}

/**
 * セグメント切替（frontend/DESIGN.md §4）
 *
 * 高さ 44px（内側 38px）。選択中は白い面、非選択は下地に文字だけ。
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={clsx('p-[3px] bg-control rounded-[10px] grid gap-[2px]', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'h-[38px] rounded-lg text-sm transition-colors disabled:opacity-50',
              selected ? 'bg-surface text-ink font-bold' : 'bg-transparent text-ink-soft font-medium'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

Segmented.displayName = 'Segmented'
