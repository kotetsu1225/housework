/**
 * 定期タスク一覧コンポーネント
 *
 * 折りたたみ可能な定期タスクの一覧表示
 */

import { useState, useMemo } from 'react'
import { ChevronDown, Clock, Edit2, Star, Users, User } from 'lucide-react'
import { clsx } from 'clsx'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { formatTimeFromISO, isParentRole } from '../../utils'
import type { TaskDefinition, Member } from '../../types'

export interface RecurringTaskListProps {
  /** タスク定義一覧（定期タスクのみフィルタリング） */
  tasks: TaskDefinition[]
  /** タスク編集時のコールバック */
  onEdit?: (task: TaskDefinition) => void
  /** タスクカードクリック時のコールバック（詳細モーダルを開く） */
  onTaskClick?: (task: TaskDefinition) => void
  /** フィルターされたスコープ（'all' | 'family' | 'personal'） */
  filterScope?: 'all' | 'family' | 'personal'
  /** メンバー一覧（個人タスクのオーナー表示用） */
  members?: Member[]
  /** 選択中のメンバーID（個人フィルター用） */
  selectedMemberId?: string | null
  /** デフォルトで展開するか */
  defaultOpen?: boolean
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
 * 定期タスクカード
 */
interface RecurringTaskCardProps {
  task: TaskDefinition
  onEdit?: (task: TaskDefinition) => void
  members?: Member[]
  currentUserId?: string
  /** カードクリック時のコールバック（詳細モーダルを開く） */
  onClick?: (task: TaskDefinition) => void
}

function RecurringTaskCard({ task, onEdit, members = [], currentUserId, onClick }: RecurringTaskCardProps) {
  const patternText = getPatternText(task)
  const owner = task.scope === 'PERSONAL' && task.ownerMemberId
    ? members.find((m) => m.id === task.ownerMemberId)
    : null

  return (
    <div
      className={clsx(
        'rounded-xl p-3 border transition-all',
        task.scope === 'FAMILY'
          ? 'bg-blue-950/30 border-blue-700/30'
          : 'bg-emerald-950/30 border-emerald-700/30',
        onClick && 'cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'
      )}
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {/* スコープバッジ */}
            <Badge
              variant={task.scope === 'FAMILY' ? 'info' : 'personal'}
              size="sm"
            >
              <span className="flex items-center gap-1">
                {task.scope === 'FAMILY' ? (
                  <Users className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                {task.scope === 'FAMILY' ? '家族' : '個人'}
              </span>
            </Badge>
            {/* 個人タスクのオーナーアバター（オーナーがいる場合のみ） */}
            {task.scope === 'PERSONAL' && owner && (
              <Avatar
                name={owner.name}
                size="sm"
                role={owner.role}
                variant={isParentRole(owner.role) ? 'parent' : 'child'}
              />
            )}
            <span className="font-medium text-white truncate">{task.name}</span>
            <Badge variant="recurring" size="sm">
              {patternText}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeFromISO(task.scheduledTimeRange.startTime)} -{' '}
              {formatTimeFromISO(task.scheduledTimeRange.endTime)}
            </span>
            {task.point > 0 && (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3 h-3 fill-amber-400" />
                {task.point}pt
              </span>
            )}
            {owner && (
              <span className="text-emerald-400">{owner.name}</span>
            )}
          </div>
        </div>

        {/* 編集ボタン（家族タスク or 自分の個人タスクのみ表示） */}
        {onEdit && (task.scope === 'FAMILY' || (task.scope === 'PERSONAL' && task.ownerMemberId === currentUserId)) && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-dark-700/50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * 折りたたみセクションコンポーネント
 */
interface CollapsibleSectionProps {
  title: string
  count: number
  variant: 'daily' | 'scheduled'
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  count,
  variant,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl border border-dark-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Badge variant={variant === 'daily' ? 'recurring' : 'info'} size="sm">
            {title}
          </Badge>
          <span className="text-white/50 text-sm">{count}件</span>
        </div>
        <ChevronDown
          className={clsx(
            'w-5 h-5 text-white/50 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>
      {isExpanded && (
        <div className="p-4 pt-0 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * 定期タスク一覧コンポーネント
 *
 * 毎日タスクと週次・月次タスクを分割して表示
 */
export function RecurringTaskList({
  tasks,
  onEdit,
  onTaskClick,
  filterScope = 'all',
  members = [],
  selectedMemberId,
  defaultOpen = false,
  currentUserId,
}: RecurringTaskListProps) {
  const [isDailyExpanded, setIsDailyExpanded] = useState(defaultOpen)
  const [isScheduledExpanded, setIsScheduledExpanded] = useState(defaultOpen)

  // 定期タスクのみを抽出してスコープでフィルタリング
  const recurringTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (task.scheduleType !== 'RECURRING') return false
      if (filterScope === 'family' && task.scope !== 'FAMILY') return false
      if (filterScope === 'personal') {
        if (task.scope !== 'PERSONAL') return false
        // 特定のメンバーでフィルター
        if (selectedMemberId && task.ownerMemberId !== selectedMemberId) return false
      }
      return true
    })
  }, [tasks, filterScope, selectedMemberId])

  // 毎日タスク
  const dailyTasks = useMemo(() => {
    return recurringTasks.filter((task) => task.recurrence?.patternType === 'DAILY')
  }, [recurringTasks])

  // 週次・月次タスク
  const scheduledTasks = useMemo(() => {
    return recurringTasks.filter((task) => {
      const patternType = task.recurrence?.patternType
      return patternType === 'WEEKLY' || patternType === 'MONTHLY'
    })
  }, [recurringTasks])

  // 両方とも空なら何も表示しない
  if (dailyTasks.length === 0 && scheduledTasks.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* 毎日の定期タスク */}
      {dailyTasks.length > 0 && (
        <CollapsibleSection
          title="毎日の定期タスク"
          count={dailyTasks.length}
          variant="daily"
          isExpanded={isDailyExpanded}
          onToggle={() => setIsDailyExpanded(!isDailyExpanded)}
        >
          {dailyTasks.map((task) => (
            <RecurringTaskCard key={task.id} task={task} onEdit={onEdit} onClick={onTaskClick} members={members} currentUserId={currentUserId} />
          ))}
        </CollapsibleSection>
      )}

      {/* 週次・月次の定期タスク */}
      {scheduledTasks.length > 0 && (
        <CollapsibleSection
          title="週次・月次の定期タスク"
          count={scheduledTasks.length}
          variant="scheduled"
          isExpanded={isScheduledExpanded}
          onToggle={() => setIsScheduledExpanded(!isScheduledExpanded)}
        >
          {scheduledTasks.map((task) => (
            <RecurringTaskCard key={task.id} task={task} onEdit={onEdit} onClick={onTaskClick} members={members} currentUserId={currentUserId} />
          ))}
        </CollapsibleSection>
      )}
    </div>
  )
}

RecurringTaskList.displayName = 'RecurringTaskList'
