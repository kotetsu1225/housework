/**
 * 完了タスク表示カード
 *
 * 完了済みタスクを表示するためのカード。
 * - MemberDetailページの今日の完了タスク
 * - CompletedExecutionsページの履歴一覧
 * で共通利用する
 */
import { CheckCircle2, Clock, Star, Users, User } from 'lucide-react'
import { clsx } from 'clsx'
import { Badge, BadgeProps } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { formatTimeFromISO, isParentRole } from '../../utils'
import type { CompletedTaskDto } from '../../api/completedTasks'
import type { Member } from '../../types'

export interface CompletedTaskCardProps {
  task: CompletedTaskDto
  onClick?: (task: CompletedTaskDto) => void
  /** メンバー一覧（アバターのrole色表示用、省略時はデフォルト色） */
  members?: Member[]
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

function getCardStyle(task: CompletedTaskDto): CardStyle {
  // カード背景色はscopeで決定（個人タスクは緑系、家族タスクは青系）
  const cardClass = task.scope === 'PERSONAL'
    ? 'bg-emerald-950/30 border-emerald-700/50'
    : 'bg-blue-950/30 border-blue-700/50'

  // バッジはscheduleTypeで決定
  if (task.scheduleType === 'ONE_TIME') {
    return {
      cardClass,
      badgeVariant: 'onetime',
      badgeText: '単発',
    }
  }
  return {
    cardClass,
    badgeVariant: 'recurring',
    badgeText: '定期',
  }
}

export function CompletedTaskCard({ task, onClick, members = [] }: CompletedTaskCardProps) {
  const handleClick = () => onClick?.(task)

  // 担当者情報を取得（roleを持つメンバー情報を取得）
  const assigneesWithRole = task.assigneeMembers.map((assignee) => {
    const member = members.find((m) => m.id === assignee.id)
    return {
      id: assignee.id,
      name: assignee.name,
      role: member?.role,
    }
  })

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
          {/* 完了アイコン */}
          <div className="flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>

          {/* タスク情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-medium truncate flex-1 text-white">
                {task.name}
              </span>
              <Badge variant="success" size="sm">完了</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50">
              {/* 家族/個人アイコン */}
              <span className="flex items-center gap-1 whitespace-nowrap">
                {task.scope === 'PERSONAL' ? (
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                )}
                {task.scope === 'PERSONAL' ? '個人' : '家族'}
              </span>

              {/* 時間 */}
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                {formatTimeFromISO(task.scheduledStartTime)} - {formatTimeFromISO(task.scheduledEndTime)}
              </span>

              {/* ポイント表示 */}
              {task.frozenPoint > 0 && (
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  +{task.frozenPoint}pt
                </span>
              )}
            </div>

            {/* 担当者表示 */}
            {assigneesWithRole.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-coral-400 font-medium">
                {assigneesWithRole.slice(0, 3).map((assignee, idx) => (
                  <span key={assignee.id} className="flex items-center gap-1">
                    {idx > 0 && <span className="text-white/30">,</span>}
                    <Avatar
                      name={assignee.name}
                      size="sm"
                      role={assignee.role}
                      variant={assignee.role && isParentRole(assignee.role) ? 'parent' : 'child'}
                    />
                    <span className="text-white/70">{assignee.name}</span>
                  </span>
                ))}
                {assigneesWithRole.length > 3 && (
                  <span className="text-white/50">他{assigneesWithRole.length - 3}名</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

CompletedTaskCard.displayName = 'CompletedTaskCard'
