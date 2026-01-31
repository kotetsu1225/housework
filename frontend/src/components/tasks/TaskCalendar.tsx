/**
 * タスクカレンダーコンポーネント
 *
 * 月表示カレンダーで単発タスクの日程を可視化
 */

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, User, Repeat } from 'lucide-react'
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

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7))
    }
    return weeks
  }, [calendarDays])

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
    <div className="bg-dark-900/30 sm:bg-dark-800/50 backdrop-blur-sm rounded-none sm:rounded-2xl p-0 sm:p-4 border-0 sm:border sm:border-dark-700/50">
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
      <div className="grid grid-cols-7 gap-0 sm:gap-1 mb-1 sm:mb-2">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={clsx(
              'text-center text-[11px] sm:text-xs font-semibold py-1 sm:py-2',
              index === 0 ? 'text-red-400' : index === 6 ? 'text-blue-400' : 'text-white/50'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダー本体 */}
      <div className="space-y-0">
        {calendarWeeks.map((week, weekIndex) => (
          <div
            key={format(week[0], 'yyyy-MM-dd')}
            className={clsx('grid grid-cols-7 gap-0')}
          >
            {week.map((day) => {
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
                    'relative min-h-[92px] sm:min-h-[110px] p-[1px] sm:p-1 flex flex-col items-start rounded-[4px] sm:rounded-lg transition-colors',
                    isCurrentMonth ? 'text-white bg-dark-800/35' : 'text-white/30 bg-dark-900/20',
                    hasTasks && isCurrentMonth && 'bg-dark-700/45',
                    isSelected && 'bg-coral-500/20 ring-1 ring-inset ring-coral-400/80',
                    isToday && !isSelected && 'ring-1 ring-inset ring-coral-400/50',
                    'hover:bg-dark-700/50'
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
                      {dayTaskItems.slice(0, 4).map(({ task, isRecurring }, index) => {
                        const owner = task.scope === 'PERSONAL' ? getOwner(task.ownerMemberId) : null
                        const showMobileOwner = task.scope === 'PERSONAL' && !!owner
                        const showMobilePersonalFallback = task.scope === 'PERSONAL' && !owner
                        const showMobileRecurring = isRecurring
                        const showMobileIcon = showMobileOwner || showMobilePersonalFallback || showMobileRecurring
                        const showDesktopOwner = showMobileOwner
                        const showDesktopPersonalFallback = showMobilePersonalFallback
                        const showDesktopRecurring = isRecurring
                        const showDesktopIcon = showDesktopOwner || showDesktopPersonalFallback || showDesktopRecurring
                        const mobileTitle = Array.from(task.name).slice(0, 4).join('')

                        return (
                          <div
                            key={`${task.id}-${isRecurring ? 'rec' : 'one'}`}
                            className={clsx(
                              index >= 2 ? 'hidden sm:flex' : 'flex',
                              'relative w-full min-w-0 items-center gap-[1px] sm:gap-0.5 text-[10px] font-medium leading-tight py-0.5 min-h-[20px] sm:min-h-0 rounded pl-[1px] pr-[1px] sm:px-1',
                              task.scope === 'FAMILY'
                                ? 'bg-blue-500/25 text-blue-100'
                                : 'bg-emerald-500/25 text-emerald-100'
                            )}
                          >
                            {showMobileIcon && (
                              <div
                                className="sm:hidden flex flex-col items-center justify-center flex-shrink-0 w-3 gap-[1px]"
                              >
                                {showMobileOwner ? (
                                  <Avatar
                                    name={owner!.name}
                                    size="xs"
                                    role={owner!.role}
                                    variant={isParentRole(owner!.role) ? 'parent' : 'child'}
                                    className="w-3 h-3 shadow-none"
                                  />
                                ) : showMobilePersonalFallback ? (
                                  <User className="w-3 h-3 text-emerald-100" />
                                ) : null}
                                {showMobileRecurring && (
                                  <Repeat className="w-3 h-3 text-amber-300 ml-[1px] sm:ml-0" />
                                )}
                              </div>
                            )}
                            {showDesktopIcon && (
                              <div className="hidden sm:flex items-center gap-0.5">
                                {showDesktopRecurring && (
                                  <Repeat className="w-2.5 h-2.5 flex-shrink-0 text-amber-400" />
                                )}
                                {showDesktopOwner ? (
                                  <Avatar
                                    name={owner!.name}
                                    size="xs"
                                    role={owner!.role}
                                    variant={isParentRole(owner!.role) ? 'parent' : 'child'}
                                    className="flex-shrink-0 w-3 h-3"
                                  />
                                ) : showDesktopPersonalFallback ? (
                                  <User className="w-2.5 h-2.5 flex-shrink-0 text-emerald-200" />
                                ) : null}
                              </div>
                            )}
                            <span
                              className="flex-1 min-w-0 text-[9px] sm:text-[9.5px] leading-[1.2] tracking-[-0.04em] pr-0 sm:pr-[1px] overflow-hidden text-clip whitespace-nowrap"
                            >
                              <span className="sm:hidden">{mobileTitle}</span>
                              <span className="hidden sm:inline">{task.name}</span>
                            </span>
                          </div>
                        )
                      })}
                      {dayTaskItems.length > 2 && (
                        <div className="text-[9px] text-white/40 px-0.5 sm:hidden">
                          +{dayTaskItems.length - 2}件
                        </div>
                      )}
                      {dayTaskItems.length > 4 && (
                        <div className="hidden sm:block text-[9px] text-white/40 px-0.5">
                          +{dayTaskItems.length - 4}件
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
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
