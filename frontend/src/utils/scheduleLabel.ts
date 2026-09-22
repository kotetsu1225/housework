/**
 * 周期・期日のチップ文言（frontend/DESIGN.md §1）
 *
 * 「定期」「単発」とは書かず、定期ならどの周期か、単発ならいつかを表示する。
 */

import type { TaskDefinition } from '../types'
import type { ScheduleDto } from '../types/api'

const DAY_OF_WEEK_LABELS: Record<string, string> = {
  MONDAY: '月',
  TUESDAY: '火',
  WEDNESDAY: '水',
  THURSDAY: '木',
  FRIDAY: '金',
  SATURDAY: '土',
  SUNDAY: '日',
}

/** ISO 曜日番号（1=月〜7=日）→ 曜日1文字 */
const ISO_DAY_LABELS = ['', '月', '火', '水', '木', '金', '土', '日']

/**
 * YYYY-MM-DD → M/d
 */
export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  const [, m, d] = dateStr.slice(0, 10).split('-')
  if (!m || !d) return dateStr
  return `${Number(m)}/${Number(d)}`
}

/**
 * API の ScheduleDto から文言を作る
 * - Daily: 毎日 / 平日毎日
 * - Weekly: 毎週火曜
 * - Monthly: 毎月15日
 * - OneTime: 9/22
 */
export function formatScheduleDtoLabel(schedule: ScheduleDto | null | undefined): string {
  if (!schedule) return ''
  if (schedule.type === 'OneTime') return formatShortDate(schedule.deadline)
  const pattern = schedule.pattern
  switch (pattern?.type) {
    case 'Daily':
      return pattern.skipWeekends ? '平日毎日' : '毎日'
    case 'Weekly':
      return `毎週${DAY_OF_WEEK_LABELS[pattern.dayOfWeek] ?? ''}曜`
    case 'Monthly':
      return `毎月${pattern.dayOfMonth}日`
    default:
      return '定期'
  }
}

/**
 * フロントの TaskDefinition から文言を作る
 */
export function formatScheduleLabel(task: Pick<TaskDefinition, 'scheduleType' | 'recurrence' | 'oneTimeDeadline'>): string {
  if (task.scheduleType === 'ONE_TIME') return formatShortDate(task.oneTimeDeadline)
  const pattern = task.recurrence
  switch (pattern?.patternType) {
    case 'DAILY':
      return pattern.dailySkipWeekends ? '平日毎日' : '毎日'
    case 'WEEKLY':
      return `毎週${ISO_DAY_LABELS[pattern.weeklyDayOfWeek ?? 1] ?? ''}曜`
    case 'MONTHLY':
      return `毎月${pattern.monthlyDayOfMonth ?? 1}日`
    default:
      return '定期'
  }
}

/**
 * 周期チップの variant（定期は cycle、単発は once）
 */
export function scheduleBadgeVariant(scheduleType: 'RECURRING' | 'ONE_TIME'): 'recurring' | 'onetime' {
  return scheduleType === 'ONE_TIME' ? 'onetime' : 'recurring'
}
