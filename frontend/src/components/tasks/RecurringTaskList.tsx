/**
 * 定期タスク一覧コンポーネント
 *
 * 「毎日の定期タスク」「週次・月次の定期タスク」の2つの箱に分けて表示する。
 * 家族／個人はカードの色で見分ける（frontend/DESIGN.md §1）。
 */

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { TaskDefinitionCard } from './TaskDefinitionCard'
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
 * 折りたたみできる箱
 */
interface CollapsibleBoxProps {
  title: string
  count: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function CollapsibleBox({ title, count, isExpanded, onToggle, children }: CollapsibleBoxProps) {
  return (
    <section className="bg-surface rounded-box p-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between gap-2 px-1 min-h-tap"
      >
        <span className="text-[15px] font-bold text-ink">{title}</span>
        <span className="flex items-center gap-1 text-[13px] text-ink-muted tabular">
          {count}件
          <ChevronDown className={clsx('w-5 h-5 text-icon-muted transition-transform', isExpanded && 'rotate-180')} />
        </span>
      </button>
      {isExpanded && children}
    </section>
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

  const canEdit = (task: TaskDefinition) =>
    task.scope === 'FAMILY' || (task.scope === 'PERSONAL' && task.ownerMemberId === currentUserId)

  const renderCard = (task: TaskDefinition) => (
    <TaskDefinitionCard
      key={task.id}
      task={task}
      members={members}
      onClick={onTaskClick}
      onEdit={onEdit}
      canEdit={canEdit(task)}
    />
  )

  return (
    <div className="space-y-3">
      {/* 毎日の定期タスク */}
      {dailyTasks.length > 0 && (
        <CollapsibleBox
          title="毎日の定期タスク"
          count={dailyTasks.length}
          isExpanded={isDailyExpanded}
          onToggle={() => setIsDailyExpanded(!isDailyExpanded)}
        >
          {dailyTasks.map(renderCard)}
        </CollapsibleBox>
      )}

      {/* 週次・月次の定期タスク */}
      {scheduledTasks.length > 0 && (
        <CollapsibleBox
          title="週次・月次の定期タスク"
          count={scheduledTasks.length}
          isExpanded={isScheduledExpanded}
          onToggle={() => setIsScheduledExpanded(!isScheduledExpanded)}
        >
          {scheduledTasks.map(renderCard)}
        </CollapsibleBox>
      )}
    </div>
  )
}

RecurringTaskList.displayName = 'RecurringTaskList'
