/**
 * 今日のタスク表示カード（Dashboard用）
 *
 * Dashboard CQRSの TodayTaskDto を表示するためのカード。
 * - 今日/明日など日付別の一覧で再利用する想定
 */
import { Calendar, CheckCircle2, Circle, Clock, PlayCircle, Users } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
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
      return <Badge variant="success">完了</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="info">進行中</Badge>
    case 'SCHEDULED':
      return <Badge variant="default">予定</Badge>
    default:
      return <Badge variant="default">やること</Badge>
  }
}

function getScheduleBadge(scheduleType: TodayTaskDto['scheduleType']) {
  switch (scheduleType) {
    case 'ONE_TIME':
      return <Badge variant="warning">単発</Badge>
    default:
      return <Badge variant="default">定期</Badge>
  }
}

export function TodayTaskCard({ task, onClick, showDate = false, members }: TodayTaskCardProps) {
  const handleClick = () => onClick(task)

  // 担当者情報を取得（複数対応）
  const assignees = task.assigneeMemberIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[]

  return (
    <Card
      variant="glass"
      hoverable
      className="flex items-center gap-4 cursor-pointer"
      onClick={handleClick}
    >
      {/* ステータスアイコン */}
      <div className="flex-shrink-0">{getStatusIcon(task.status)}</div>

      {/* タスク情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span
            className={`font-medium truncate ${
              task.status === 'COMPLETED' ? 'text-white/50 line-through' : 'text-white'
            }`}
          >
            {task.taskName}
          </span>
          {getStatusBadge(task.status)}
          {getScheduleBadge(task.scheduleType)}
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

          <span className="flex items-center gap-1 whitespace-nowrap">
            {task.scope === 'FAMILY' ? (
              <Users className="w-3.5 h-3.5" />
            ) : (
              <span className="w-3.5 h-3.5 text-xs">👤</span>
            )}
            {task.scope === 'FAMILY' ? '家族' : '個人'}
          </span>

          {task.assigneeMemberNames.length > 0 && (
            <span className="flex items-center gap-1.5 text-coral-400 font-medium whitespace-nowrap">
              {assignees.length > 0 ? (
                <>
                  {assignees.slice(0, 2).map((assignee, idx) => (
                    <span key={assignee.id} className="flex items-center gap-1.5">
                      {idx > 0 && <span className="text-white/30">,</span>}
                      <Avatar
                        name={assignee.name}
                        size="sm"
                        role={assignee.role}
                        variant={isParentRole(assignee.role) ? 'parent' : 'child'}
                      />
                      <span>{assignee.name}</span>
                    </span>
                  ))}
                  {assignees.length > 2 && (
                    <span className="text-white/50">他{assignees.length - 2}名</span>
                  )}
                </>
              ) : (
                <span>未割当</span>
              )}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

TodayTaskCard.displayName = 'TodayTaskCard'


