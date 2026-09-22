/**
 * 通知許可モーダルコンポーネント
 *
 * Push通知の許可をリクエストするモーダル
 */

import { Bell } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export interface NotificationPermissionModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean
  /** モーダルを閉じるコールバック */
  onClose: () => void
  /** 通知を許可するコールバック */
  onAllow: () => Promise<void>
  /** 今はしないコールバック */
  onDismiss: () => void
  /** 登録中かどうか */
  isRegistering?: boolean
}

/**
 * 通知許可モーダル
 *
 * ユーザーにPush通知の許可をリクエストします
 */
export function NotificationPermissionModal({
  isOpen,
  onClose,
  onAllow,
  onDismiss,
  isRegistering = false,
}: NotificationPermissionModalProps) {
  const handleAllow = async () => {
    await onAllow()
    onClose()
  }

  const handleDismiss = () => {
    onDismiss()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="通知を有効にしますか？"
      showCloseButton={false}
      closeOnOverlayClick={false}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center py-4">
          <div className="bg-family rounded-full p-6">
            <Bell className="w-12 h-12 text-accent" />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-ink text-base font-medium">
            未完了のタスクがあるとき、通知でお知らせします。
          </p>
          <p className="text-ink-muted text-sm">
            毎日19時に未完了の毎日タスクを通知します。
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={handleAllow}
            disabled={isRegistering}
            loading={isRegistering}
            className="w-full"
          >
            {isRegistering ? '設定中...' : '許可する'}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleDismiss}
            disabled={isRegistering}
            className="w-full"
          >
            今はしない
          </Button>
        </div>
      </div>
    </Modal>
  )
}
