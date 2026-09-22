/**
 * 明日のタスク詳細（閲覧専用）モーダル
 *
 * - 明日のタスク一覧からクリックしたタスクを、読みやすいレイアウトで表示する
 * - 状態変更（開始/完了/割り当て）は行わない
 */
import { AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import { formatJa, formatTimeFromISO, isParentRole } from '../../utils'
import { formatShortDate, scheduleBadgeVariant } from '../../utils/scheduleLabel'
import type { TodayTaskDto } from '../../api/dashboard'
import type { Member } from '../../types'

export interface TomorrowTaskDetailModalProps {
  isOpen: boolean
  task: TodayTaskDto | null
  members: Member[]
  onClose: () => void
  onBackToList: () => void
  /** 周期の文言（毎日、毎週火曜など） */
  scheduleLabel?: string
}

function toDisplayDate(dateStr: string) {
  // scheduledDate は YYYY-MM-DD を想定（Dashboard API）
  // 表示目的なのでローカル日のズレが起きにくいように 00:00 を付与
  return new Date(`${dateStr}T00:00:00`)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0">
      <p className="w-16 flex-shrink-0 text-[13px] text-ink-muted pt-0.5">{label}</p>
      <div className="flex-1 min-w-0 text-[15px] font-medium text-ink">{children}</div>
    </div>
  )
}

export function TomorrowTaskDetailModal({
  isOpen,
  task,
  members,
  onClose,
  onBackToList,
  scheduleLabel,
}: TomorrowTaskDetailModalProps) {
  if (!task) return null

  const assignees = task.assigneeMemberIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[]
  const label =
    scheduleLabel ?? (task.scheduleType === 'ONE_TIME' ? formatShortDate(task.scheduledDate) : '定期')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="タスク詳細"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onBackToList} className="flex-1">
            一覧に戻る
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
            閉じる
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* SCHEDULED ステータスの場合は注意書きを表示 */}
        {task.status === 'SCHEDULED' && (
          <div className="flex items-start gap-2 p-3 bg-once rounded-card">
            <AlertCircle className="w-5 h-5 text-once-ink flex-shrink-0 mt-0.5" />
            <div className="text-sm text-once-ink">
              <p className="font-bold">予定タスク</p>
              <p className="mt-0.5">
                このタスクはまだ実行が作成されていません。当日の朝に自動で作成されます。
              </p>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-[17px] font-bold text-ink leading-snug">{task.taskName}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={scheduleBadgeVariant(task.scheduleType)} size="sm">
              {label}
            </Badge>
            <Badge variant={task.scope === 'FAMILY' ? 'success' : 'personal'} size="sm">
              {task.scope === 'FAMILY' ? '家族' : '個人'}
            </Badge>
            {task.status === 'SCHEDULED' && <Badge variant="default" size="sm">予定</Badge>}
          </div>
        </div>

        <div className="bg-canvas rounded-card px-3.5">
          <Row label="日付">{formatJa(toDisplayDate(task.scheduledDate), 'M月d日（E）')}</Row>
          <Row label="時間">
            <span className="tabular">
              {formatTimeFromISO(task.scheduledStartTime)}–{formatTimeFromISO(task.scheduledEndTime)}
            </span>
          </Row>
          <Row label="種別">{task.scope === 'FAMILY' ? '家族タスク' : '個人タスク'}</Row>
          <Row label="担当者">
            {task.assigneeMemberNames.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {assignees.map((assignee) => (
                  <div key={assignee.id} className="flex items-center gap-1.5">
                    <Avatar
                      name={assignee.name}
                      size="sm"
                      role={assignee.role}
                      variant={isParentRole(assignee.role) ? 'parent' : 'child'}
                      className="w-6 h-6"
                    />
                    <span>{assignee.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-danger">担当者がいません</span>
            )}
          </Row>
        </div>

        {task.taskDescription ? (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-ink-soft">説明</p>
            <div className="bg-canvas rounded-card p-3.5 text-ink text-sm leading-relaxed whitespace-pre-wrap">
              {task.taskDescription}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">説明はありません</p>
        )}
      </div>
    </Modal>
  )
}

TomorrowTaskDetailModal.displayName = 'TomorrowTaskDetailModal'
