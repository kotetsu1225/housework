/**
 * タスクカレンダーコンポーネント
 *
 * 月表示カレンダーで単発タスクと週次・月次の定期タスクの日程を可視化
 * - 日付の下にタスク名の先頭4文字を、家族／個人の色で表示
 * - 当日は白地に accent の枠線、日付を accent の丸で囲む（frontend/DESIGN.md §5）
 */

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { clsx } from 'clsx'
import { isRecurringTaskOnDate } from '../../utils'
import type { TaskDefinition, Member } from '../../types'

export interface TaskCalendarProps {
  /** タスク定義一覧（単発タスクのみフィルタリング） */
  tasks: TaskDefinition[]
  /** 選択中の日付 */
  selectedDate: Date
  /** 日付選択時のコールバック */
  onSelectDate: (date: Date) => void
  /** フィルターされたスコープ（'all' | 'family' | 'personal'） */
  filterScope?: 'all' | 'family' | 'personal'
  /** メンバー一覧（個人タスクのオーナー表示用） */
  members?: Member[]
  /** 選択中のメンバーID（個人フィルター用） */
  selectedMemberId?: string | null
}

/**
 * 曜日ヘッダー
 */
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 1日に表示するタスク名の最大数 */
const MAX_TITLES_PER_DAY = 4

/**
 * タスクカレンダーコンポーネント
 */
export function TaskCalendar({
  tasks,
  selectedDate,
  onSelectDate,
  filterScope = 'all',
  selectedMemberId,
}: TaskCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))

  // スコープでフィルタリングするヘルパー
  const filterByScope = (task: TaskDefinition) => {
    if (filterScope === 'family' && task.scope !== 'FAMILY') return false
    if (filterScope === 'personal') {
      if (task.scope !== 'PERSONAL') return false
      if (selectedMemberId && task.ownerMemberId !== selectedMemberId) return false
    }
    return true
  }

  // 単発タスクを抽出
  const oneTimeTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (task.scheduleType !== 'ONE_TIME') return false
      return filterByScope(task)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filterScope, selectedMemberId])

  // 週次・月次の定期タスク（毎日は除外）
  const nonDailyRecurringTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (task.scheduleType !== 'RECURRING') return false
      if (!task.recurrence) return false
      // 毎日タスクは除外（カレンダーには週次・月次のみ表示）
      if (task.recurrence.patternType === 'DAILY') return false
      return filterByScope(task)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filterScope, selectedMemberId])

  // カレンダーの日付配列を生成（tasksByDateより先に定義する必要あり）
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  // 日付ごとのタスクをマッピング（単発 + 週次・月次定期）
  const tasksByDate = useMemo(() => {
    const result: Record<string, { task: TaskDefinition; isRecurring: boolean }[]> = {}

    // 単発タスクを追加
    oneTimeTasks.forEach((task) => {
      if (task.oneTimeDeadline) {
        const dateKey = task.oneTimeDeadline
        if (!result[dateKey]) {
          result[dateKey] = []
        }
        result[dateKey].push({ task, isRecurring: false })
      }
    })

    // 週次・月次定期タスクを各日にマッピング
    calendarDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd')

      nonDailyRecurringTasks.forEach((task) => {
        if (isRecurringTaskOnDate(task, day)) {
          if (!result[dateKey]) {
            result[dateKey] = []
          }
          result[dateKey].push({ task, isRecurring: true })
        }
      })
    })

    return result
  }, [oneTimeTasks, nonDailyRecurringTasks, calendarDays])

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  return (
    <div className="bg-surface rounded-xl px-2 pt-1.5 pb-3">
      {/* ヘッダー: 月の表示と移動ボタン */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="前の月"
          className="w-11 h-11 flex items-center justify-center rounded-full text-accent active:bg-control"
        >
          <ChevronLeft className="w-[22px] h-[22px]" />
        </button>
        <h3 className="text-[17px] font-bold text-ink tabular">
          {format(currentMonth, 'yyyy年M月', { locale: ja })}
        </h3>
        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="次の月"
          className="w-11 h-11 flex items-center justify-center rounded-full text-accent active:bg-control"
        >
          <ChevronRight className="w-[22px] h-[22px]" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={clsx(
              'text-center text-xs font-medium py-1',
              index === 0 ? 'text-danger' : index === 6 ? 'text-cycle-ink' : 'text-ink-muted'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダー本体 */}
      <div className="grid grid-cols-7 gap-[2px]">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayTaskItems = tasksByDate[dateKey] || []
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = isSameDay(day, selectedDate)
          const isToday = isSameDay(day, new Date())
          const dayOfWeek = day.getDay()

          // 前後月の日付は表示しない（薄い文字はコントラスト 4.5:1 を満たせないため）
          if (!isCurrentMonth) {
            return <div key={dateKey} aria-hidden="true" className="min-h-[78px]" />
          }

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(day)}
              aria-label={format(day, 'M月d日', { locale: ja })}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              className={clsx(
                'min-h-[78px] px-[2px] pt-1 pb-1 flex flex-col items-center gap-[3px] rounded-lg transition-colors',
                isSelected && !isToday && 'bg-control',
                isToday && 'bg-surface shadow-[inset_0_0_0_2px_#1F7A4D]'
              )}
            >
              <span
                className={clsx(
                  'text-sm tabular leading-none',
                  isToday
                    ? 'w-[22px] h-[22px] rounded-full bg-accent text-white font-bold flex items-center justify-center text-[13px]'
                    : dayOfWeek === 0
                      ? 'text-danger'
                      : dayOfWeek === 6
                        ? 'text-cycle-ink'
                        : 'text-ink'
                )}
              >
                {format(day, 'd')}
              </span>

              {/* タスク名表示（最大4件、先頭4文字） */}
              {dayTaskItems.slice(0, MAX_TITLES_PER_DAY).map(({ task, isRecurring }) => (
                  <span
                    key={`${task.id}-${isRecurring ? 'rec' : 'one'}`}
                    className={clsx(
                      'w-full box-border px-[3px] rounded text-[9.5px] font-bold leading-[1.5] tracking-[-0.04em] whitespace-nowrap overflow-hidden text-left',
                      task.scope === 'FAMILY' ? 'bg-family-chip text-family-ink' : 'bg-personal-chip text-personal-ink'
                    )}
                  >
                    {Array.from(task.name).slice(0, 4).join('')}
                  </span>
                ))}
              {dayTaskItems.length > MAX_TITLES_PER_DAY && (
                <span className="text-[9px] text-ink-muted tabular">+{dayTaskItems.length - MAX_TITLES_PER_DAY}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 凡例（家族／個人はカードと同じ色） */}
      <div className="flex items-center gap-3.5 mt-2 px-2 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-family-chip" />
          家族
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-personal-chip" />
          個人
        </span>
      </div>
    </div>
  )
}

TaskCalendar.displayName = 'TaskCalendar'
