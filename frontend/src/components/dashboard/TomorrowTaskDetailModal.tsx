/**
 * 明日のタスク詳細（閲覧専用）モーダル
 *
 * - 明日のタスク一覧からクリックしたタスクを、読みやすいレイアウトで表示する
 * - 状態変更（開始/完了/割り当て）は行わない
 */
import { AlertCircle, Calendar, Clock, User, Users } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Avatar } from '../ui/Avatar'
import { formatJa, formatTimeFromISO, isParentRole } from '../../utils'
import type { TodayTaskDto } from '../../api/dashboard'
import type { Member } from '../../types'

export interface TomorrowTaskDetailModalProps {
  isOpen: boolean
  task: TodayTaskDto | null
  members: Member[]
  onClose: () => void
  onBackToList: () => void
}

function getScheduleBadge(scheduleType: TodayTaskDto['scheduleType']) {
  switch (scheduleType) {
    case 'ONE_TIME':
      return <Badge variant="warning">単発</Badge>
    default:
      return <Badge variant="default">定期</Badge>
  }
}

function getScopeBadge(scope: TodayTaskDto['scope']) {
  return scope === 'FAMILY' ? <Badge variant="default">家族</Badge> : <Badge variant="default">個人</Badge>
}

function toDisplayDate(dateStr: string) {
  // scheduledDate は YYYY-MM-DD を想定（Dashboard API）
  // 表示目的なのでローカル日のズレが起きにくいように 00:00 を付与
  return new Date(`${dateStr}T00:00:00`)
}

export function TomorrowTaskDetailModal({
  isOpen,
  task,
  members,
  onClose,
  onBackToList,
}: TomorrowTaskDetailModalProps) {
  if (!task) return null

  const assignees = task.assigneeMemberIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="タスク詳細"
      footer={
        <>
          <button
            type="button"
            onClick={onBackToList}
            className="flex-1 bg-dark-800 hover:bg-dark-700 text-white rounded-lg py-3 font-medium transition-colors"
          >
            一覧に戻る
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-dark-800 hover:bg-dark-700 text-white rounded-lg py-3 font-medium transition-colors"
          >
            閉じる
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* SCHEDULED ステータスの場合は注意書きを表示 */}
        {task.status === 'SCHEDULED' && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">予定タスク</p>
              <p className="text-amber-200/70 mt-0.5">
                このタスクはまだ実行が作成されていません。当日の朝に自動で作成されます。
              </p>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-bold text-white leading-snug">{task.taskName}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {getScheduleBadge(task.scheduleType)}
            {getScopeBadge(task.scope)}
            {task.status === 'SCHEDULED' && <Badge variant="warning">予定</Badge>}
          </div>
        </div>

        <Card variant="glass" className="p-4 space-y-3">
          <div className="flex items-start gap-2 text-white/80">
            <Calendar className="w-4 h-4 mt-0.5 text-shazam-400" />
            <div className="flex-1">
              <p className="text-sm text-white/60">日付</p>
              <p className="font-medium">{formatJa(toDisplayDate(task.scheduledDate), 'M月d日（E）')}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-white/80">
            <Clock className="w-4 h-4 mt-0.5 text-white/60" />
            <div className="flex-1">
              <p className="text-sm text-white/60">時間</p>
              <p className="font-medium">
                {formatTimeFromISO(task.scheduledStartTime)} - {formatTimeFromISO(task.scheduledEndTime)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-white/80">
            {task.scope === 'FAMILY' ? (
              <Users className="w-4 h-4 mt-0.5 text-white/60" />
            ) : (
              <User className="w-4 h-4 mt-0.5 text-white/60" />
            )}
            <div className="flex-1">
              <p className="text-sm text-white/60">種別</p>
              <p className="font-medium">{task.scope === 'FAMILY' ? '家族タスク' : '個人タスク'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-white/80">
            <User className="w-4 h-4 mt-0.5 text-coral-400" />
            <div className="flex-1">
              <p className="text-sm text-white/60">担当者</p>
              {task.assigneeMemberNames.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {assignees.map((assignee) => (
                    <div key={assignee.id} className="flex items-center gap-2">
                      <Avatar
                        name={assignee.name}
                        size="sm"
                        role={assignee.role}
                        variant={isParentRole(assignee.role) ? 'parent' : 'child'}
                      />
                      <span className="font-medium text-white">{assignee.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-medium text-white/50">未割り当て</p>
              )}
            </div>
          </div>
        </Card>

        {task.taskDescription ? (
          <div className="space-y-2">
            <p className="text-sm text-white/70 font-medium">説明</p>
            <div className="bg-dark-800/50 rounded-lg p-4 text-white/80 leading-relaxed whitespace-pre-wrap">
              {task.taskDescription}
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/40">説明はありません</div>
        )}
      </div>
    </Modal>
  )
}

TomorrowTaskDetailModal.displayName = 'TomorrowTaskDetailModal'


