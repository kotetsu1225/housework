/**
 * Toast通知コンポーネント（Radix Toast ベース）
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
import * as RadixToast from '@radix-ui/react-toast'
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

/** バリアントごとのアイコン（暗い面の上なので明るい色） */
const variantConfig: Record<ToastVariant, { icon: typeof CheckCircle; iconClass: string }> = {
  success: { icon: CheckCircle, iconClass: 'text-[#7BD3A5]' },
  error: { icon: XCircle, iconClass: 'text-[#F5A19A]' },
  warning: { icon: AlertCircle, iconClass: 'text-[#F3C56B]' },
  info: { icon: Info, iconClass: 'text-[#9EC5F5]' },
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
    <RadixToast.Root
      duration={TOAST_DURATION}
      onOpenChange={(open) => {
        if (!open) onRemove(toast.id)
      }}
      className={clsx(
        'flex items-center gap-3 pl-4 pr-1 py-1 min-h-tap rounded-xl bg-ink text-white',
        'data-[state=open]:animate-toast-in data-[swipe=end]:animate-toast-out'
      )}
    >
      <Icon className={clsx('w-5 h-5 flex-shrink-0', config.iconClass)} aria-hidden="true" />
      <RadixToast.Description className="text-sm font-medium flex-1 py-2">
        {toast.message}
      </RadixToast.Description>
      <RadixToast.Close asChild>
        <button
          type="button"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-white/70 hover:text-white"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </RadixToast.Close>
    </RadixToast.Root>
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
      setToasts((prev) => [...prev, { id, message, variant }])
    },
    []
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      <RadixToast.Provider swipeDirection="up" label="通知">
        {children}
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
        <RadixToast.Viewport className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 max-w-sm mx-auto outline-none safe-top" />
      </RadixToast.Provider>
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
