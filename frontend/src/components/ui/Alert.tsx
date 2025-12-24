import { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

export type AlertVariant = 'error' | 'success' | 'warning' | 'info'

export interface AlertProps {
  /** アラートの種類 */
  variant?: AlertVariant
  /** メッセージ */
  children: ReactNode
  /** 追加のクラス名 */
  className?: string
  /** アイコンを表示するか */
  showIcon?: boolean
}

const variantStyles: Record<AlertVariant, string> = {
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
}

const variantIcons: Record<AlertVariant, ReactNode> = {
  error: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
  success: <CheckCircle2 className="w-5 h-5 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
  info: <Info className="w-5 h-5 flex-shrink-0" />,
}

/**
 * 再利用可能なアラートコンポーネント
 *
 * @example
 * ```tsx
 * <Alert variant="error">エラーが発生しました</Alert>
 * <Alert variant="success">保存しました</Alert>
 * ```
 */
export function Alert({
  variant = 'info',
  children,
  className,
  showIcon = true,
}: AlertProps) {
  return (
    <div
      className={clsx(
        'p-4 border rounded-xl flex items-center gap-3',
        variantStyles[variant],
        className
      )}
      role="alert"
    >
      {showIcon && variantIcons[variant]}
      <p className="text-sm">{children}</p>
    </div>
  )
}

Alert.displayName = 'Alert'

