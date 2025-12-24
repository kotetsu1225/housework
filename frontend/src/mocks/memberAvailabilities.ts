/**
 * 空き時間関連のモックデータ
 *
 * @note バックエンドにGETエンドポイントが追加されるまでの暫定データ
 * @see docs/BACKEND_ISSUES.md - 問題3: GETエンドポイントの欠如
 */

import { addDays } from 'date-fns'
import type { MemberAvailability } from '../types'
import { toISODateString } from '../utils'

/**
 * モック空き時間データを生成
 *
 * @returns 空き時間データ配列
 */
export function createMockAvailabilities(): MemberAvailability[] {
  const today = toISODateString(new Date())
  const tomorrow = toISODateString(addDays(new Date(), 1))

  return [
    {
      id: 'av-1',
      memberId: '1',
      targetDate: today,
      slots: [{ startTime: '10:00', endTime: '12:00', memo: '買い物後' }],
    },
    {
      id: 'av-2',
      memberId: '2',
      targetDate: today,
      slots: [{ startTime: '15:00', endTime: '18:00', memo: '学校から帰宅後' }],
    },
    {
      id: 'av-3',
      memberId: '3',
      targetDate: today,
      slots: [{ startTime: '16:00', endTime: '17:00', memo: null }],
    },
    {
      id: 'av-4',
      memberId: '2',
      targetDate: tomorrow,
      slots: [{ startTime: '10:00', endTime: '12:00', memo: null }],
    },
  ]
}

