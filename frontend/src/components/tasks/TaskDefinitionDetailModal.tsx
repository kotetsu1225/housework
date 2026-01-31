/**
 * タスク定義詳細モーダル
 *
 * - カレンダーや定期タスクリストからクリックしたタスクの詳細を表示
 * - 編集権限がある場合は編集ボタンを表示
 */
import { Clock, Edit2, Repeat, Star, User, Users } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import { formatTimeFromISO, isParentRole } from '../../utils'
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

/**
 * 繰り返しパターンをテキストに変換
 */
function getPatternText(task: TaskDefinition): string {
  const recurrence = task.recurrence
  if (!recurrence) return '定期'

  switch (recurrence.patternType) {
    case 'DAILY':
      if (recurrence.dailySkipWeekends) {
        return '平日毎日'
      }
      return '毎日'
    case 'WEEKLY': {
      const days = ['月', '火', '水', '木', '金', '土', '日']
      const dayIndex = (recurrence.weeklyDayOfWeek ?? 1) - 1
      const dayName = days[dayIndex] ?? '?'
      return `毎週${dayName}曜日`
    }
    case 'MONTHLY': {
      const day = recurrence.monthlyDayOfMonth ?? 1
      return `毎月${day}日`
    }
    default:
      return '定期'
  }
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
          {onEdit && canEdit && (
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleEdit}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              編集
            </Button>
          )}
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            閉じる
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* タスク名とバッジ */}
        <div>
          <h3 className="text-lg font-bold text-white leading-snug">{task.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* スコープバッジ */}
            <Badge variant={task.scope === 'FAMILY' ? 'info' : 'personal'} size="sm">
              <span className="flex items-center gap-1">
                {task.scope === 'FAMILY' ? (
                  <Users className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                {task.scope === 'FAMILY' ? '家族' : '個人'}
              </span>
            </Badge>
            {/* スケジュールタイプバッジ */}
            {task.scheduleType === 'RECURRING' ? (
              <Badge variant="recurring" size="sm">
                <span className="flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {getPatternText(task)}
                </span>
              </Badge>
            ) : (
              <Badge variant="warning" size="sm">
                単発
              </Badge>
            )}
          </div>
        </div>

        {/* 詳細情報カード */}
        <Card variant="glass" className="p-4 space-y-3">
          {/* 時間 */}
          <div className="flex items-start gap-2 text-white/80">
            <Clock className="w-4 h-4 mt-0.5 text-white/60" />
            <div className="flex-1">
              <p className="text-sm text-white/60">時間</p>
              <p className="font-medium">
                {formatTimeFromISO(task.scheduledTimeRange.startTime)} -{' '}
                {formatTimeFromISO(task.scheduledTimeRange.endTime)}
              </p>
            </div>
          </div>

          {/* ポイント（家族タスクの場合のみ表示） */}
          {task.scope === 'FAMILY' && task.point > 0 && (
            <div className="flex items-start gap-2 text-white/80">
              <Star className="w-4 h-4 mt-0.5 text-amber-400 fill-amber-400" />
              <div className="flex-1">
                <p className="text-sm text-white/60">ポイント</p>
                <p className="font-medium text-amber-400">{task.point}pt</p>
              </div>
            </div>
          )}

          {/* オーナー情報（個人タスクの場合） */}
          {task.scope === 'PERSONAL' && (
            <div className="flex items-start gap-2 text-white/80">
              <User className="w-4 h-4 mt-0.5 text-emerald-400" />
              <div className="flex-1">
                <p className="text-sm text-white/60">オーナー</p>
                {owner ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar
                      name={owner.name}
                      size="sm"
                      role={owner.role}
                      variant={isParentRole(owner.role) ? 'parent' : 'child'}
                    />
                    <span className="font-medium text-white">{owner.name}</span>
                  </div>
                ) : (
                  <p className="font-medium text-white/50">不明</p>
                )}
              </div>
            </div>
          )}

          {/* 種別 */}
          <div className="flex items-start gap-2 text-white/80">
            {task.scope === 'FAMILY' ? (
              <Users className="w-4 h-4 mt-0.5 text-blue-400" />
            ) : (
              <User className="w-4 h-4 mt-0.5 text-emerald-400" />
            )}
            <div className="flex-1">
              <p className="text-sm text-white/60">種別</p>
              <p className="font-medium">{task.scope === 'FAMILY' ? '家族タスク' : '個人タスク'}</p>
            </div>
          </div>

          {/* 定期スケジュール詳細 */}
          {task.scheduleType === 'RECURRING' && task.recurrence && (
            <div className="flex items-start gap-2 text-white/80">
              <Repeat className="w-4 h-4 mt-0.5 text-coral-400" />
              <div className="flex-1">
                <p className="text-sm text-white/60">繰り返し</p>
                <p className="font-medium">{getPatternText(task)}</p>
                {task.recurrence.startDate && (
                  <p className="text-sm text-white/50 mt-1">
                    開始日: {task.recurrence.startDate}
                    {task.recurrence.endDate && ` 〜 ${task.recurrence.endDate}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 単発タスクの期限 */}
          {task.scheduleType === 'ONE_TIME' && task.oneTimeDeadline && (
            <div className="flex items-start gap-2 text-white/80">
              <Clock className="w-4 h-4 mt-0.5 text-coral-400" />
              <div className="flex-1">
                <p className="text-sm text-white/60">期限</p>
                <p className="font-medium">{task.oneTimeDeadline}</p>
              </div>
            </div>
          )}
        </Card>

        {/* 説明 */}
        {task.description ? (
          <div className="space-y-2">
            <p className="text-sm text-white/70 font-medium">説明</p>
            <div className="bg-dark-800/50 rounded-lg p-4 text-white/80 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/40">説明はありません</div>
        )}
      </div>
    </Modal>
  )
}

TaskDefinitionDetailModal.displayName = 'TaskDefinitionDetailModal'
