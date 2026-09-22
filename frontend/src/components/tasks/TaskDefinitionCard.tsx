/**
 * タスク定義カード
 *
 * タスク画面（定期タスク一覧・日付モーダル）とタスク一覧画面で共通利用する。
 * 家族／個人はカードの色、周期・期日はチップで表す（frontend/DESIGN.md §5）。
 */
import { Pencil, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { formatTimeFromISO, isParentRole } from '../../utils'
import { formatScheduleLabel, scheduleBadgeVariant } from '../../utils/scheduleLabel'
import type { TaskDefinition, Member } from '../../types'

export interface TaskDefinitionCardProps {
  task: TaskDefinition
  /** メンバー一覧（個人タスクのオーナー表示用） */
  members?: Member[]
  /** カードクリック（詳細を開く） */
  onClick?: (task: TaskDefinition) => void
  /** 編集ボタン */
  onEdit?: (task: TaskDefinition) => void
  /** 削除ボタン */
  onDelete?: (task: TaskDefinition) => void
  /** 編集・削除できるか（false のとき操作ボタンを出さない） */
  canEdit?: boolean
  /** 説明を1行表示するか */
  showDescription?: boolean
}

export function TaskDefinitionCard({
  task,
  members = [],
  onClick,
  onEdit,
  onDelete,
  canEdit = true,
  showDescription = false,
}: TaskDefinitionCardProps) {
  const owner =
    task.scope === 'PERSONAL' && task.ownerMemberId
      ? members.find((m) => m.id === task.ownerMemberId)
      : null
  const label = formatScheduleLabel(task)
  const hasActions = canEdit && (onEdit || onDelete)

  const body = (
    <span className="flex-1 min-w-0 flex flex-col gap-1.5">
      <span className="flex items-center gap-2">
        {label && (
          <Badge variant={scheduleBadgeVariant(task.scheduleType)} size="sm">
            {label}
          </Badge>
        )}
        <span className="flex-1 min-w-0 text-[17px] font-medium text-ink truncate">{task.name}</span>
      </span>
      {showDescription && task.description && (
        <span className="text-[13px] text-ink-muted truncate">{task.description}</span>
      )}
      <span className="flex items-center gap-2 text-[13px] text-ink-muted tabular">
        <span className="whitespace-nowrap">
          {formatTimeFromISO(task.scheduledTimeRange.startTime)}–{formatTimeFromISO(task.scheduledTimeRange.endTime)}
        </span>
        {owner && (
          <span className="flex items-center gap-1 min-w-0">
            <Avatar
              name={owner.name}
              size="xs"
              role={owner.role}
              variant={isParentRole(owner.role) ? 'parent' : 'child'}
              className="w-5 h-5"
            />
            <span className="truncate">{owner.name}</span>
          </span>
        )}
        {!canEdit && (onEdit || onDelete) && (
          <span className="text-icon-muted whitespace-nowrap">他メンバーのタスク</span>
        )}
        {task.point > 0 && (
          <span className="ml-auto font-bold text-accent whitespace-nowrap">{task.point}pt</span>
        )}
      </span>
    </span>
  )

  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded-card',
        task.scope === 'PERSONAL' ? 'bg-personal' : 'bg-family',
        hasActions ? 'pl-3.5 pr-0.5 py-2' : 'px-3.5 py-3'
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={() => onClick(task)}
          className="flex-1 min-w-0 text-left min-h-tap flex items-center"
        >
          {body}
        </button>
      ) : (
        <div className="flex-1 min-w-0 flex items-center">{body}</div>
      )}

      {hasActions && (
        <span className="flex items-center flex-shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(task)
              }}
              aria-label={`${task.name}を編集`}
              className="w-11 h-11 flex items-center justify-center rounded-full text-ink-muted active:bg-control"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task)
              }}
              aria-label={`${task.name}を削除`}
              className="w-11 h-11 flex items-center justify-center rounded-full text-danger active:bg-control"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </span>
      )}
    </div>
  )
}

TaskDefinitionCard.displayName = 'TaskDefinitionCard'
