/**
 * 完了タスク表示カード
 *
 * 完了済みタスクを表示するためのカード。
 * - MemberDetailページの今日の完了タスク
 * - CompletedExecutionsページの履歴一覧
 * で共通利用する。家族／個人はカードの色、周期・期日はチップで表す。
 */
import { Check } from 'lucide-react'
import { clsx } from 'clsx'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { formatTimeFromISO, isParentRole } from '../../utils'
import { formatShortDate, scheduleBadgeVariant } from '../../utils/scheduleLabel'
import type { CompletedTaskDto } from '../../api/completedTasks'
import type { Member } from '../../types'

export interface CompletedTaskCardProps {
  task: CompletedTaskDto
  onClick?: (task: CompletedTaskDto) => void
  /** メンバー一覧（アバターのrole色表示用、省略時はデフォルト色） */
  members?: Member[]
  /** 周期の文言（毎日、毎週火曜など） */
  scheduleLabel?: string
  /** 日付を出すか（履歴一覧のように複数日が混ざるとき） */
  showDate?: boolean
}

export function CompletedTaskCard({ task, onClick, members = [], scheduleLabel, showDate = false }: CompletedTaskCardProps) {
  // 担当者情報を取得（roleを持つメンバー情報を取得）
  const assigneesWithRole = task.assigneeMembers.map((assignee) => {
    const member = members.find((m) => m.id === assignee.id)
    return {
      id: assignee.id,
      name: assignee.name,
      role: member?.role,
    }
  })

  const label =
    scheduleLabel ?? (task.scheduleType === 'ONE_TIME' ? formatShortDate(task.scheduledDate) : '定期')

  const body = (
    <>
      <span aria-label="完了" className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-accent">
        <Check className="w-6 h-6" strokeWidth={2.5} />
      </span>

      <span className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <Badge variant={scheduleBadgeVariant(task.scheduleType)} size="sm">
            {label}
          </Badge>
          <span className="flex-1 min-w-0 text-[17px] font-medium text-ink truncate">{task.name}</span>
          {task.frozenPoint > 0 && (
            <span className="text-[15px] font-bold text-accent tabular flex-shrink-0">+{task.frozenPoint}pt</span>
          )}
        </span>

        <span className="flex items-center gap-2 text-[13px] text-ink-muted tabular">
          <span className="whitespace-nowrap">
            {showDate && `${formatShortDate(task.scheduledDate)} `}
            {formatTimeFromISO(task.completedAt)} 完了
          </span>

          {assigneesWithRole.length > 0 && (
            <span className="ml-auto flex items-center gap-1 min-w-0">
              <span className="flex items-center">
                {assigneesWithRole.slice(0, 3).map((assignee, idx) => (
                  <Avatar
                    key={assignee.id}
                    name={assignee.name}
                    size="xs"
                    role={assignee.role}
                    variant={assignee.role && isParentRole(assignee.role) ? 'parent' : 'child'}
                    className={clsx('w-5 h-5', idx > 0 && '-ml-2 ring-[1.5px] ring-surface')}
                  />
                ))}
              </span>
              <span className="truncate">
                {assigneesWithRole.slice(0, 3).map((a) => a.name).join('、')}
                {assigneesWithRole.length > 3 && ` 他${assigneesWithRole.length - 3}名`}
              </span>
            </span>
          )}
        </span>
      </span>
    </>
  )

  const className = clsx(
    'w-full text-left flex items-center gap-3 px-3.5 py-3 min-h-tap rounded-card',
    task.scope === 'PERSONAL' ? 'bg-personal' : 'bg-family'
  )

  if (onClick) {
    return (
      <button type="button" onClick={() => onClick(task)} className={clsx(className, 'transition-colors', task.scope === 'PERSONAL' ? 'active:bg-personal-chip' : 'active:bg-family-chip')}>
        {body}
      </button>
    )
  }

  return <div className={className}>{body}</div>
}

CompletedTaskCard.displayName = 'CompletedTaskCard'
