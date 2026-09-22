/**
 * タスク定義詳細モーダル
 *
 * - カレンダーや定期タスクリストからクリックしたタスクの詳細を表示
 * - 編集権限がある場合は編集ボタンを表示
 */
import { Pencil } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import { formatTimeFromISO, isParentRole } from '../../utils'
import { formatScheduleLabel, scheduleBadgeVariant } from '../../utils/scheduleLabel'
import type { TaskDefinition, Member } from '../../types'

export interface TaskDefinitionDetailModalProps {
  /** モーダル表示状態 */
  isOpen: boolean
  /** モーダルを閉じるコールバック */
  onClose: () => void
  /** 表示するタスク定義（nullの場合は何も表示しない） */
  task: TaskDefinition | null
  /** 編集ボタンクリック時のコールバック */
  onEdit?: (task: TaskDefinition) => void
  /** メンバー一覧（オーナー表示用） */
  members?: Member[]
  /** 現在のユーザーID（編集権限判定用） */
  currentUserId?: string
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0">
      <p className="w-16 flex-shrink-0 text-[13px] text-ink-muted pt-0.5">{label}</p>
      <div className="flex-1 min-w-0 text-[15px] font-medium text-ink">{children}</div>
    </div>
  )
}

/**
 * タスク定義詳細モーダル
 */
export function TaskDefinitionDetailModal({
  isOpen,
  onClose,
  task,
  onEdit,
  members = [],
  currentUserId,
}: TaskDefinitionDetailModalProps) {
  if (!task) return null

  // 編集権限判定: 家族タスクは誰でも、個人タスクはオーナーのみ
  const canEdit = task.scope === 'FAMILY' ||
    (task.scope === 'PERSONAL' && task.ownerMemberId === currentUserId)

  // オーナー情報取得（個人タスクの場合）
  const owner = task.scope === 'PERSONAL' && task.ownerMemberId
    ? members.find((m) => m.id === task.ownerMemberId)
    : null

  const handleEdit = () => {
    if (onEdit && task) {
      onEdit(task)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="タスク詳細"
      footer={
        <>
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            閉じる
          </Button>
          {onEdit && canEdit && (
            <Button variant="primary" size="lg" className="flex-1" onClick={handleEdit}>
              <Pencil className="w-4 h-4" />
              編集
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* タスク名とチップ */}
        <div>
          <h3 className="text-[17px] font-bold text-ink leading-snug">{task.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={scheduleBadgeVariant(task.scheduleType)} size="sm">
              {formatScheduleLabel(task)}
            </Badge>
            <Badge variant={task.scope === 'FAMILY' ? 'success' : 'personal'} size="sm">
              {task.scope === 'FAMILY' ? '家族' : '個人'}
            </Badge>
          </div>
        </div>

        {/* 詳細情報 */}
        <div className="bg-canvas rounded-card px-3.5">
          <Row label="時間">
            <span className="tabular">
              {formatTimeFromISO(task.scheduledTimeRange.startTime)}–{formatTimeFromISO(task.scheduledTimeRange.endTime)}
            </span>
          </Row>

          {task.scope === 'FAMILY' && task.point > 0 && (
            <Row label="ポイント">
              <span className="text-accent font-bold tabular">{task.point}pt</span>
            </Row>
          )}

          {task.scope === 'PERSONAL' && (
            <Row label="オーナー">
              {owner ? (
                <span className="flex items-center gap-2">
                  <Avatar
                    name={owner.name}
                    size="sm"
                    role={owner.role}
                    variant={isParentRole(owner.role) ? 'parent' : 'child'}
                    className="w-6 h-6"
                  />
                  <span>{owner.name}</span>
                </span>
              ) : (
                <span className="text-ink-muted">不明</span>
              )}
            </Row>
          )}

          <Row label="種別">{task.scope === 'FAMILY' ? '家族タスク' : '個人タスク'}</Row>

          {task.scheduleType === 'RECURRING' && task.recurrence && (
            <Row label="繰り返し">
              <span>{formatScheduleLabel(task)}</span>
              {task.recurrence.startDate && (
                <p className="text-[13px] font-normal text-ink-muted mt-0.5 tabular">
                  {task.recurrence.startDate} から
                  {task.recurrence.endDate && ` ${task.recurrence.endDate} まで`}
                </p>
              )}
            </Row>
          )}

          {task.scheduleType === 'ONE_TIME' && task.oneTimeDeadline && (
            <Row label="期限">
              <span className="tabular">{task.oneTimeDeadline}</span>
            </Row>
          )}
        </div>

        {/* 説明 */}
        {task.description ? (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-ink-soft">説明</p>
            <div className="bg-canvas rounded-card p-3.5 text-ink text-sm leading-relaxed whitespace-pre-wrap">
              {task.description}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">説明はありません</p>
        )}
      </div>
    </Modal>
  )
}

TaskDefinitionDetailModal.displayName = 'TaskDefinitionDetailModal'
