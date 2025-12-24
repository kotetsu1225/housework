/**
 * メンバー関連のモックデータ
 *
 * @note バックエンドにGETエンドポイントが追加されるまでの暫定データ
 * @see docs/BACKEND_ISSUES.md - 問題3: GETエンドポイントの欠如
 */

import type { Member } from '../types'

/**
 * メンバー統計情報
 */
export interface MemberStats {
  completed: number
  total: number
  streak: number
}

/**
 * 統計情報付きメンバー
 */
export type MemberWithStats = Member & { stats: MemberStats }

/**
 * モックメンバーデータ（基本）
 */
export const MOCK_MEMBERS: Member[] = [
  { id: '1', name: '母', role: 'MOTHER', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: '2', name: '太郎', role: 'BROTHER', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: '3', name: '花子', role: 'SISTER', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
]

/**
 * モックメンバーデータ（統計情報付き）
 */
export const MOCK_MEMBERS_WITH_STATS: MemberWithStats[] = [
  {
    id: '1',
    name: '母',
    role: 'MOTHER',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    stats: { completed: 145, total: 150, streak: 7 },
  },
  {
    id: '2',
    name: '太郎',
    role: 'BROTHER',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    stats: { completed: 89, total: 100, streak: 5 },
  },
  {
    id: '3',
    name: '花子',
    role: 'SISTER',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    stats: { completed: 72, total: 85, streak: 3 },
  },
]

/**
 * メンバーIDからメンバーを取得
 */
export function getMockMemberById(id: string): Member | undefined {
  return MOCK_MEMBERS.find((m) => m.id === id)
}

