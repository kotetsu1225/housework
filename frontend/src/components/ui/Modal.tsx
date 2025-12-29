import { ReactNode, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

export interface ModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean
  /** モーダルを閉じるコールバック */
  onClose: () => void
  /** モーダルのタイトル */
  title: string
  /** モーダルのコンテンツ */
  children: ReactNode
  /** フッター（ボタン等） */
  footer?: ReactNode
  /** 閉じるボタンを表示するか */
  showCloseButton?: boolean
  /** オーバーレイクリックで閉じるか */
  closeOnOverlayClick?: boolean
  /** 追加のクラス名 */
  className?: string
}

/**
 * 再利用可能なモーダルコンポーネント
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="メンバーを追加"
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={handleCancel}>キャンセル</Button>
 *       <Button variant="primary" onClick={handleSubmit}>追加</Button>
 *     </>
 *   }
 * >
 *   <Input label="名前" value={name} onChange={...} />
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = false,
  className,
}: ModalProps) {
  // ESCキーで閉じる
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // スクロールを無効化
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-[60]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={clsx(
          'bg-dark-900 w-full max-w-lg rounded-t-3xl p-6 safe-bottom animate-slide-up',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-xl font-bold text-white">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-800 rounded-full transition-colors"
              aria-label="閉じる"
            >
              <X className="w-5 h-5 text-dark-400" />
            </button>
          )}
        </div>

        {/* コンテンツ */}
        <div className="space-y-4">{children}</div>

        {/* フッター */}
        {footer && <div className="flex gap-3 mt-8">{footer}</div>}
      </div>
    </div>
  )
}

Modal.displayName = 'Modal'

