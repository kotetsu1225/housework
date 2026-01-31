/**
 * 完了タスクAPI関数
 *
 * 完了済みタスク一覧取得のAPI呼び出しを提供
 */

import { apiGet } from './client'

/**
 * 担当者DTO
 */
export interface AssigneeMemberDto {
  id: string
  name: string
}

/**
 * 完了タスクDTO
 */
export interface CompletedTaskDto {
  taskExecutionId: string
  taskDefinitionId: string
  name: string
  description: string | null
  scheduledStartTime: string
  scheduledEndTime: string
  frozenPoint: number
  definitionVersion: number
  scope: 'FAMILY' | 'PERSONAL'
  scheduleType: 'RECURRING' | 'ONE_TIME'
  ownerMemberId: string | null
  assigneeMembers: AssigneeMemberDto[]
  scheduledDate: string
  completedAt: string
}

/**
 * 完了タスク一覧APIレスポンス
 */
export interface GetCompletedTasksResponse {
  completedTasks: CompletedTaskDto[]
  hasMore: boolean
}

/**
 * 完了タスク一覧取得オプション
 */
export interface GetCompletedTasksOptions {
  /** 担当者IDでフィルタ */
  memberIds?: string[]
  /** 日付でフィルタ（YYYY-MM-DD形式） */
  date?: string
  /** 取得件数（デフォルト: 50） */
  limit?: number
  /** オフセット（デフォルト: 0） */
  offset?: number
}

/**
 * 完了タスク一覧を取得する
 *
 * GET /api/completed-tasks?memberIds=xxx,yyy&date=YYYY-MM-DD&limit=50&offset=0
 *
 * @param options - フィルタオプション
 * @returns 完了タスク一覧とhasMore
 *
 * @example
 * ```typescript
 * // 今日の完了タスクを取得
 * const { completedTasks } = await getCompletedTasks({ date: '2025-01-31' })
 *
 * // 特定メンバーの完了タスクを取得
 * const { completedTasks } = await getCompletedTasks({ memberIds: ['xxx'] })
 *
 * // 全期間の完了タスクを取得（ページネーション）
 * const { completedTasks, hasMore } = await getCompletedTasks({ limit: 50, offset: 0 })
 * ```
 */
export async function getCompletedTasks(
  options: GetCompletedTasksOptions = {}
): Promise<GetCompletedTasksResponse> {
  const params = new URLSearchParams()

  if (options.memberIds && options.memberIds.length > 0) {
    params.append('memberIds', options.memberIds.join(','))
  }
  if (options.date) {
    params.append('date', options.date)
  }
  if (options.limit !== undefined) {
    params.append('limit', String(options.limit))
  }
  if (options.offset !== undefined) {
    params.append('offset', String(options.offset))
  }

  const queryString = params.toString()
  const endpoint = queryString ? `/completed-tasks?${queryString}` : '/completed-tasks'

  return apiGet<GetCompletedTasksResponse>(endpoint)
}
