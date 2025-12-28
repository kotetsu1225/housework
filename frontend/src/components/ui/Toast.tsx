/**
 * Toast通知コンポーネント
 *
 * API成功/エラー時の通知を表示する
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { clsx } from 'clsx'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

/** Toast通知のバリアント */
type ToastVariant = 'success' | 'error' | 'warning' | 'info'

/** Toast通知の型定義 */
interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

/** Toastコンテキストの型定義 */
interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, variant?: ToastVariant) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

/** Toast自動消去時間（ミリ秒） */
const TOAST_DURATION = 4000

/** バリアントごとのアイコンとスタイル */
const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle; bgClass: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle,
    bgClass: 'bg-green-500/20 border-green-500/50',
    iconClass: 'text-green-400',
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-500/20 border-red-500/50',
    iconClass: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    bgClass: 'bg-yellow-500/20 border-yellow-500/50',
    iconClass: 'text-yellow-400',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/20 border-blue-500/50',
    iconClass: 'text-blue-400',
  },
}

/**
 * 単一のToastアイテム
 */
function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast
  onRemove: (id: string) => void
}) {
  const config = variantConfig[toast.variant]
  const Icon = config.icon

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-lg',
        'animate-in slide-in-from-top-2 fade-in duration-200',
        config.bgClass
      )}
      role="alert"
    >
      <Icon className={clsx('w-5 h-5 flex-shrink-0', config.iconClass)} />
      <p className="text-white text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="閉じる"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>
    </div>
  )
}

/**
 * Toastコンテナ（画面右上に固定表示）
 */
function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[]
  onRemove: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}

/**
 * ToastProvider
 *
 * アプリ全体でToast通知を使用可能にするProvider
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const newToast: Toast = { id, message, variant }

      setToasts((prev) => [...prev, newToast])

      // 自動消去
      setTimeout(() => {
        removeToast(id)
      }, TOAST_DURATION)
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

/**
 * Toast通知を表示するためのカスタムフック
 *
 * @example
 * ```tsx
 * const { showToast } = useToast()
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData()
 *     showToast('保存しました', 'success')
 *   } catch {
 *     showToast('保存に失敗しました', 'error')
 *   }
 * }
 * ```
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
