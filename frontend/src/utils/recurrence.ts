/**
 * 定期タスクの判定ユーティリティ
 */

import { addDays } from 'date-fns'
import type { TaskDefinition } from '../types'
import { toISODateString } from './date'

const DAY_OF_WEEK_ORDER = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

/**
 * 曜日文字列をISO(1=月曜〜7=日曜)に変換
 */
export function dayOfWeekToIsoNumber(dayOfWeek: string): number {
  const index = DAY_OF_WEEK_ORDER.indexOf(dayOfWeek)
  if (index === -1) return 1
  return index === 0 ? 7 : index
}

/**
 * DateをISO(1=月曜〜7=日曜)に変換
 */
export function dateToIsoDayOfWeek(date: Date): number {
  const jsDay = date.getDay() // 0=日, 1=月, ..., 6=土
  return jsDay === 0 ? 7 : jsDay
}

/**
 * 日付文字列をYYYY-MM-DDに正規化
 */
export function normalizeIsoDateString(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const trimmed = dateStr.trim()
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed
}

/**
 * 開始・終了日範囲に含まれるか判定
 */
export function isDateWithinRange(date: Date, startDate?: string | null, endDate?: string | null): boolean {
  const dateStr = toISODateString(date)
  const start = normalizeIsoDateString(startDate)
  const end = normalizeIsoDateString(endDate)

  if (start && start > dateStr) return false
  if (end && end < dateStr) return false
  return true
}

/**
 * 指定された日付が定期タスクに該当するか
 */
export function isRecurringTaskOnDate(task: TaskDefinition, date: Date): boolean {
  if (task.scheduleType !== 'RECURRING') return false
  if (!task.recurrence) return false

  const pattern = task.recurrence
  if (!isDateWithinRange(date, pattern.startDate, pattern.endDate)) return false

  switch (pattern.patternType) {
    case 'DAILY': {
      if (pattern.dailySkipWeekends) {
        const day = date.getDay()
        return day !== 0 && day !== 6
      }
      return true
    }
    case 'WEEKLY': {
      const isoDay = dateToIsoDayOfWeek(date)
      return isoDay === (pattern.weeklyDayOfWeek ?? 1)
    }
    case 'MONTHLY':
      return date.getDate() === (pattern.monthlyDayOfMonth ?? 1)
    default:
      return false
  }
}

/**
 * 週次の開始日を、指定曜日の直近(同日含む)に合わせる
 */
export function alignStartDateToWeeklyDay(startDate: Date, targetDayOfWeek: string): Date {
  const targetIso = dayOfWeekToIsoNumber(targetDayOfWeek)
  const baseIso = dateToIsoDayOfWeek(startDate)
  let diff = targetIso - baseIso
  if (diff < 0) diff += 7
  return addDays(startDate, diff)
}
