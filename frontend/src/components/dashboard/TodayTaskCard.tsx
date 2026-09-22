/**
 * 今日のタスク表示カード（Dashboard用）
 *
 * Dashboard CQRSの TodayTaskDto を表示するためのカード。
 * - 今日/明日など日付別の一覧で再利用する想定
 * - 家族／個人はカードの色、周期・期日はカード内のチップで表す（frontend/DESIGN.md §5）
 */
import { CalendarClock, Check, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { formatJa, formatTimeFromISO, isParentRole } from '../../utils'
import { formatShortDate, scheduleBadgeVariant } from '../../utils/scheduleLabel'
import type { TodayTaskDto } from '../../api/dashboard'
import type { Member } from '../../types'

export interface TodayTaskCardProps {
  task: TodayTaskDto
  onClick: (task: TodayTaskDto) => void
  /** 将来のタスク用に日付を表示するか */
  showDate?: boolean
  /** メンバー一覧（アバター表示用） */
  members: Member[]
  /** 周期の文言（毎日、毎週火曜など）。無ければ単発は日付、定期は「定期」 */
  scheduleLabel?: string
}

/**
 * 左端の状態マーク
 * - 未着手: 薄いグレーの輪
 * - 進行中: accent の輪と中の丸
 * - 完了: accent のチェック
 * - 予定（実行未生成）: カレンダーアイコン
 */
function StatusMark({ status }: { status: TodayTaskDto['status'] }) {
  switch (status) {
    case 'IN_PROGRESS':
      return (
        <span
          aria-label="進行中"
          className="w-7 h-7 box-border rounded-full border-[2.5px] border-accent bg-surface flex items-center justify-center flex-shrink-0"
        >
          <span className="w-[13px] h-[13px] rounded-full bg-accent" />
        </span>
      )
    case 'COMPLETED':
      return (
        <span aria-label="完了" className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-accent">
          <Check className="w-6 h-6" strokeWidth={2.5} />
        </span>
      )
    case 'CANCELLED':
      return (
        <span aria-label="キャンセル" className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-icon-muted">
          <X className="w-6 h-6" />
        </span>
      )
    case 'SCHEDULED':
      return (
        <span aria-label="予定" className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-ink-muted">
          <CalendarClock className="w-6 h-6" />
        </span>
      )
    default:
      return (
        <span
          aria-label="未着手"
          className="w-7 h-7 box-border rounded-full border-2 border-line-strong bg-surface flex-shrink-0"
        />
      )
  }
}

/**
 * ポイント表示
 * - 未実行: taskDefinition.point
 * - 進行中/完了: taskExecution.frozenPoint（スナップショット時のポイント）
 */
function displayPoint(task: TodayTaskDto): number {
  const isStarted = task.status === 'IN_PROGRESS' || task.status === 'COMPLETED'
  return isStarted ? (task.frozenPoint ?? task.point ?? 0) : (task.point ?? 0)
}

export function TodayTaskCard({ task, onClick, showDate = false, members, scheduleLabel }: TodayTaskCardProps) {
  const handleClick = () => onClick(task)

  // 担当者情報を取得（複数対応）
  const assignees = task.assigneeMemberIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[]

  const label =
    scheduleLabel ?? (task.scheduleType === 'ONE_TIME' ? formatShortDate(task.scheduledDate) : '定期')
  const point = displayPoint(task)
  const isDone = task.status === 'COMPLETED' || task.status === 'CANCELLED'

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        'w-full text-left flex items-center gap-3 px-3.5 py-3 min-h-tap rounded-card transition-colors',
        task.scope === 'PERSONAL' ? 'bg-personal active:bg-personal-chip' : 'bg-family active:bg-family-chip'
      )}
    >
      <StatusMark status={task.status} />

      <span className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* 1行目: 周期チップ + タスク名 + pt */}
        <span className="flex items-center gap-2">
          <Badge variant={scheduleBadgeVariant(task.scheduleType)} size="sm">
            {label}
          </Badge>
          <span
            className={clsx(
              'flex-1 min-w-0 text-[17px] font-medium truncate',
              isDone ? 'text-ink-muted line-through' : 'text-ink'
            )}
          >
            {task.taskName}
          </span>
          {point > 0 && (
            <span className="text-[15px] font-bold text-accent tabular flex-shrink-0">
              {task.status === 'COMPLETED' ? '+' : ''}
              {point}pt
            </span>
          )}
        </span>

        {/* 2行目: 日付・時刻 + 担当者 */}
        <span className="flex items-center gap-2 text-[13px] text-ink-muted tabular">
          {showDate && task.scheduledDate && (
            <span className="whitespace-nowrap">{formatJa(new Date(`${task.scheduledDate}T00:00:00`), 'M月d日')}</span>
          )}
          {task.scheduledStartTime && task.scheduledEndTime && (
            <span className="whitespace-nowrap">
              {formatTimeFromISO(task.scheduledStartTime)}–{formatTimeFromISO(task.scheduledEndTime)}
            </span>
          )}

          {assignees.length > 0 ? (
            <span className="ml-auto flex items-center gap-1 min-w-0">
              <span className="flex items-center">
                {assignees.slice(0, 3).map((assignee, idx) => (
                  <Avatar
                    key={assignee.id}
                    name={assignee.name}
                    size="xs"
                    role={assignee.role}
                    variant={isParentRole(assignee.role) ? 'parent' : 'child'}
                    className={clsx('w-5 h-5', idx > 0 && '-ml-2 ring-[1.5px] ring-surface')}
                  />
                ))}
              </span>
              <span className="truncate">
                {assignees.slice(0, 3).map((a) => a.name).join('、')}
                {assignees.length > 3 && ` 他${assignees.length - 3}名`}
              </span>
            </span>
          ) : (
            task.scope === 'FAMILY' &&
            !isDone && (
              <span className="ml-auto text-danger font-medium whitespace-nowrap">担当者がいません</span>
            )
          )}
        </span>
      </span>
    </button>
  )
}

TodayTaskCard.displayName = 'TodayTaskCard'
