/**
 * タスクカレンダーコンポーネント
 *
 * 月表示カレンダーで単発タスクの日程を可視化
 */

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Users, User, Repeat } from 'lucide-react'
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
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import { isParentRole, isRecurringTaskOnDate } from '../../utils'
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

/**
 * タスクカレンダーコンポーネント
 */
export function TaskCalendar({
  tasks,
  selectedDate,
  onSelectDate,
  filterScope = 'all',
  members = [],
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
  }, [tasks, filterScope, selectedMemberId])

  // オーナーメンバーを取得するヘルパー
  const getOwner = (ownerMemberId: string | undefined) => {
    if (!ownerMemberId) return null
    return members.find((m) => m.id === ownerMemberId)
  }

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

  // 前月へ移動
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  // 次月へ移動
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  return (
    <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-4 border border-dark-700/50">
      {/* ヘッダー: 月の表示と移動ボタン */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-lg font-bold text-white">
          {format(currentMonth, 'yyyy年M月', { locale: ja })}
        </h3>
        <Button variant="ghost" size="sm" onClick={handleNextMonth}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={clsx(
              'text-center text-xs font-medium py-2',
              index === 0 ? 'text-red-400' : index === 6 ? 'text-blue-400' : 'text-white/50'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダー本体 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayTaskItems = tasksByDate[dateKey] || []
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = isSameDay(day, selectedDate)
          const isToday = isSameDay(day, new Date())
          const dayOfWeek = day.getDay()
          const hasTasks = dayTaskItems.length > 0

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={clsx(
                'relative min-h-[95px] p-1 flex flex-col items-start rounded-lg transition-all',
                'hover:bg-dark-700/50',
                isCurrentMonth ? 'text-white' : 'text-white/30',
                isSelected && 'bg-coral-500/20 border border-coral-500',
                isToday && !isSelected && 'bg-dark-700/50 border border-dark-600',
                hasTasks && !isSelected && 'bg-dark-700/30'
              )}
            >
              <span
                className={clsx(
                  'text-sm font-medium mb-1',
                  isToday && 'text-coral-400 font-bold',
                  dayOfWeek === 0 && isCurrentMonth && 'text-red-400',
                  dayOfWeek === 6 && isCurrentMonth && 'text-blue-400'
                )}
              >
                {format(day, 'd')}
              </span>

              {/* タスク名表示（最大4件） */}
              {hasTasks && isCurrentMonth && (
                <div className="w-full space-y-0.5 overflow-hidden">
                  {dayTaskItems.slice(0, 4).map(({ task, isRecurring }) => {
                    const owner = task.scope === 'PERSONAL' ? getOwner(task.ownerMemberId) : null
                    return (
                      <div
                        key={`${task.id}-${isRecurring ? 'rec' : 'one'}`}
                        className={clsx(
                          'flex items-center gap-0.5 text-[9px] leading-tight px-0.5 py-0.5 rounded',
                          task.scope === 'FAMILY'
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'bg-emerald-500/30 text-emerald-300'
                        )}
                      >
                        {/* 定期タスクの場合はリピートアイコンを表示 */}
                        {isRecurring ? (
                          <Repeat className="w-2.5 h-2.5 flex-shrink-0 text-amber-400" />
                        ) : task.scope === 'FAMILY' ? (
                          <Users className="w-2.5 h-2.5 flex-shrink-0" />
                        ) : owner ? (
                          <Avatar
                            name={owner.name}
                            size="xs"
                            role={owner.role}
                            variant={isParentRole(owner.role) ? 'parent' : 'child'}
                          />
                        ) : (
                          <User className="w-2.5 h-2.5 flex-shrink-0" />
                        )}
                        <span className="truncate">{task.name}</span>
                      </div>
                    )
                  })}
                  {dayTaskItems.length > 4 && (
                    <div className="text-[9px] text-white/40 px-0.5">
                      +{dayTaskItems.length - 4}件
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-white/50">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>家族</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>個人</span>
        </div>
        <div className="flex items-center gap-1">
          <Repeat className="w-3 h-3 text-amber-400" />
          <span>週次/月次</span>
        </div>
      </div>
    </div>
  )
}

TaskCalendar.displayName = 'TaskCalendar'
