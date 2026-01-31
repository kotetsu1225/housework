/**
 * 今日のタスク表示カード（Dashboard用）
 *
 * Dashboard CQRSの TodayTaskDto を表示するためのカード。
 * - 今日/明日など日付別の一覧で再利用する想定
 */
import { Calendar, CheckCircle2, Circle, Clock, PlayCircle, Star } from 'lucide-react'
import { clsx } from 'clsx'
import { Badge, BadgeProps } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { formatJa, formatTimeFromISO, isParentRole } from '../../utils'
import type { TodayTaskDto } from '../../api/dashboard'
import type { Member } from '../../types'

/**
 * 今日のタスクカードコンポーネント
 */
export interface TodayTaskCardProps {
  task: TodayTaskDto
  onClick: (task: TodayTaskDto) => void
  /** 将来のタスク用に日付を表示するか */
  showDate?: boolean
  /** メンバー一覧（アバター表示用） */
  members: Member[]
}

/**
 * カードスタイルを決定する
 * scope と scheduleType に基づいて、バッジとカード背景色を決定
 */
interface CardStyle {
  cardClass: string
  badgeVariant: BadgeProps['variant']
  badgeText: string
}

function getCardStyle(task: TodayTaskDto): CardStyle {
  // カード背景色はscopeで決定（個人タスクは緑系、家族タスクは青系）
  const cardClass = task.scope === 'PERSONAL'
    ? 'bg-emerald-950/30 border-emerald-700/50'
    : 'bg-blue-950/30 border-blue-700/50'

  // バッジはscheduleTypeで決定（常に「定期」か「単発」を表示）
  if (task.scheduleType === 'ONE_TIME') {
    return {
      cardClass,
      badgeVariant: 'onetime',
      badgeText: '単発',
    }
  }
  // 定期タスク
  return {
    cardClass,
    badgeVariant: 'recurring',
    badgeText: '定期',
  }
}

/**
 * ステータスに応じたアイコンを取得
 */
function getStatusIcon(status: TodayTaskDto['status']) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    case 'IN_PROGRESS':
      return <PlayCircle className="w-5 h-5 text-shazam-400" />
    case 'SCHEDULED':
      return <Calendar className="w-5 h-5 text-white/40" />
    default:
      return <Circle className="w-5 h-5 text-white/30" />
  }
}

/**
 * ステータスに応じたバッジを取得
 */
function getStatusBadge(status: TodayTaskDto['status']) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="success" size="sm">完了</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="info" size="sm">進行中</Badge>
    case 'SCHEDULED':
      return <Badge variant="default" size="sm">予定</Badge>
    default:
      return <Badge variant="default" size="sm">未</Badge>
  }
}

/**
 * ポイント表示コンポーネント
 * - 未実行: taskDefinition.point
 * - 進行中/完了: taskExecution.frozenPoint（スナップショット時のポイント）
 */
function PointDisplay({ task }: { task: TodayTaskDto }) {
  // 進行中または完了の場合はfrozenPointを使用、それ以外はpointを使用
  const isStarted = task.status === 'IN_PROGRESS' || task.status === 'COMPLETED'
  const displayPoint = isStarted ? (task.frozenPoint ?? task.point ?? 0) : (task.point ?? 0)
  
  if (!displayPoint || displayPoint <= 0) return null
  
  return (
    <span className="flex items-center gap-1 text-amber-400 font-bold text-sm">
      <Star className="w-3.5 h-3.5 fill-amber-400" />
      +{displayPoint}pt
    </span>
  )
}

export function TodayTaskCard({ task, onClick, showDate = false, members }: TodayTaskCardProps) {
  const handleClick = () => onClick(task)

  // 担当者情報を取得（複数対応）
  const assignees = task.assigneeMemberIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[]

  const cardStyle = getCardStyle(task)

  return (
    <div className="relative mt-4">
      {/* 左上バッジ（カードの枠の外側、上部に配置） */}
      <div className="absolute -top-3 left-2 z-10">
        <Badge variant={cardStyle.badgeVariant} size="sm">
          {cardStyle.badgeText}
        </Badge>
      </div>

      <div
        className={clsx(
          'rounded-2xl p-4 pt-3 border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg',
          cardStyle.cardClass
        )}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
        {/* ステータスアイコン */}
        <div className="flex-shrink-0 mt-0.5">{getStatusIcon(task.status)}</div>

        {/* タスク情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={clsx(
                'font-medium truncate flex-1',
                task.status === 'COMPLETED' ? 'text-white/50 line-through' : 'text-white'
              )}
            >
              {task.taskName}
            </span>
            {getStatusBadge(task.status)}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50">
            {/* 期限が今日じゃない場合は日付を表示 */}
            {showDate && task.scheduledDate && (
              <span className="flex items-center gap-1 text-shazam-400 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5" />
                {formatJa(new Date(task.scheduledDate), 'M月d日')}
              </span>
            )}

            {task.scheduledStartTime && task.scheduledEndTime && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                {formatTimeFromISO(task.scheduledStartTime)} - {formatTimeFromISO(task.scheduledEndTime)}
              </span>
            )}

            {/* ポイント表示 */}
            <PointDisplay task={task} />
          </div>

          {/* 担当者表示 */}
          {assignees.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-coral-400 font-medium">
              {assignees.slice(0, 3).map((assignee, idx) => (
                <span key={assignee.id} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-white/30">,</span>}
                  <Avatar
                    name={assignee.name}
                    size="sm"
                    role={assignee.role}
                    variant={isParentRole(assignee.role) ? 'parent' : 'child'}
                  />
                  <span className="text-white/70">{assignee.name}</span>
                </span>
              ))}
              {assignees.length > 3 && (
                <span className="text-white/50">他{assignees.length - 3}名</span>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

TodayTaskCard.displayName = 'TodayTaskCard'


