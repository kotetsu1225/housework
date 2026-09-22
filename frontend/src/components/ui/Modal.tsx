import { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
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
 * 下から出るシート型のモーダル（Radix Dialog ベース）
 *
 * フォーカスの閉じ込め、Esc で閉じる、背景スクロールの固定、
 * aria 属性は Radix に任せ、見た目だけをここで決める（frontend/DESIGN.md §4）。
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
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="modal-overlay"
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />
        <Dialog.Content
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (!closeOnOverlayClick) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (!closeOnOverlayClick) e.preventDefault()
          }}
          className={clsx(
            'fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] w-full max-w-lg',
            'bg-surface rounded-t-box px-4 pt-3 pb-4 safe-bottom',
            'max-h-[85dvh] overflow-y-auto overscroll-contain',
            'focus:outline-none',
            className
          )}
        >
          {/* つまみ */}
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-control" aria-hidden="true" />

          {/* ヘッダー */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <Dialog.Title id="modal-title" className="text-[20px] font-bold text-ink">
              {title}
            </Dialog.Title>
            {showCloseButton && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-ink-muted hover:bg-control transition-colors"
                  aria-label="閉じる"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            )}
          </div>

          {/* コンテンツ */}
          <div className="space-y-4">{children}</div>

          {/* フッター */}
          {footer && <div className="flex gap-3 mt-6">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

Modal.displayName = 'Modal'
