/**
 * Dashboard API関数
 *
 * ダッシュボード画面用のAPI呼び出しを提供
 * CQRSパターン: 複数集約のデータを1リクエストで取得
 */

import { apiGet } from './client'

/**
 * 今日のタスクDTO
 */
export interface TodayTaskDto {
  taskExecutionId: string
  taskDefinitionId: string
  taskName: string
  taskDescription: string | null
  scheduledStartTime: string // HH:mm format
  scheduledEndTime: string // HH:mm format
  scope: 'FAMILY' | 'PERSONAL'
  /** タスク定義のスケジュール種別 */
  scheduleType: 'RECURRING' | 'ONE_TIME'
  /**
   * タスクの状態
   * - NOT_STARTED: 未着手（実行あり）
   * - IN_PROGRESS: 進行中（実行あり）
   * - COMPLETED: 完了（実行あり）
   * - CANCELLED: キャンセル（実行あり）
   * - SCHEDULED: 予定（実行未生成、定義のみ）
   */
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SCHEDULED'
  /** PERSONALの場合のオーナー（FAMILYはnull） */
  ownerMemberId: string | null
  assigneeMemberIds: string[] // CHANGED: was assigneeMemberId (singular)
  assigneeMemberNames: string[] // CHANGED: was assigneeMemberName (singular), now array
  scheduledDate: string
}

/**
 * メンバーの個別タスクDTO
 */
export interface MemberTaskDto {
  taskExecutionId: string
  taskName: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SCHEDULED'
}

/**
 * メンバーごとのタスクサマリーDTO
 */
export interface MemberTaskSummaryDto {
  memberId: string
  memberName: string
  familyRole: string
  completedCount: number
  totalCount: number
  tasks: MemberTaskDto[]
}

/**
 * ダッシュボードAPIレスポンス
 */
export interface DashboardResponse {
  todayTasks: TodayTaskDto[]
  memberSummaries: MemberTaskSummaryDto[]
}

/**
 * ダッシュボードデータを取得する
 *
 * GET /api/dashboard?date=YYYY-MM-DD
 *
 * @param date - 対象日（YYYY-MM-DD形式）、省略時は今日
 * @returns ダッシュボードデータ（今日のタスク、メンバーサマリー）
 *
 * @example
 * ```typescript
 * // 今日のデータを取得
 * const data = await getDashboardData()
 *
 * // 特定の日のデータを取得
 * const data = await getDashboardData('2025-12-29')
 * ```
 */
export async function getDashboardData(date?: string): Promise<DashboardResponse> {
  const endpoint = date ? `/dashboard?date=${date}` : '/dashboard'
  return apiGet<DashboardResponse>(endpoint)
}
