/**
 * TaskExecution API関数
 *
 * タスク実行関連のAPI呼び出しを提供
 * @see doc/task-execution-api.md
 */

import { apiGet, apiPost } from './client'
import type {
  GetTaskExecutionsResponse,
  TaskExecutionResponse,
  StartTaskExecutionRequest,
  CompleteTaskExecutionRequest,
  AssignTaskExecutionRequest,
  GenerateTaskExecutionsResponse,
} from '../types/api'

/**
 * TaskExecution一覧取得のフィルタオプション
 */
/**
 * NOTE: This option replaces the previous 'date' field.
 * The backend expects 'scheduledDate' as the query parameter name.
 */
export interface GetTaskExecutionsOptions {
  /** 実行予定日でフィルタ (YYYY-MM-DD) */
  scheduledDate?: string
  /** ステータスでフィルタ */
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  /** 担当者IDsでフィルタ（バックエンド: assigneeMemberId） */
  assigneeMemberIds?: string[] // CHANGED: now array to support multiple assignees
  /** 完了日時でフィルタ (YYYY-MM-DD) */
  completedAt?: string
  /** 取得件数（デフォルト: 20） */
  limit?: number
  /** オフセット（デフォルト: 0） */
  offset?: number
}

/**
 * TaskExecution一覧を取得する
 * GET /api/task-executions
 *
 * @param options - フィルタオプション
 * @returns TaskExecution一覧
 *
 * @example
 * ```typescript
 * // 今日のタスクを取得
 * const { taskExecutions } = await getTaskExecutions({
 *   date: '2024-12-27'
 * })
 *
 * // 特定メンバーの未着手タスクを取得
 * const { taskExecutions } = await getTaskExecutions({
 *   memberId: 'xxx',
 *   status: 'NOT_STARTED'
 * })
 * ```
 */
export async function getTaskExecutions(
  options: GetTaskExecutionsOptions = {}
): Promise<GetTaskExecutionsResponse> {
  const params = new URLSearchParams()

  if (options.scheduledDate) params.append('scheduledDate', options.scheduledDate)
  if (options.status) params.append('status', options.status)
  const memberIds = options.assigneeMemberIds
  if (memberIds && memberIds.length > 0) {
    memberIds.forEach((id) => params.append('assigneeMemberId', id))
  }
  if (options.completedAt) params.append('completedAt', options.completedAt)
  if (options.limit !== undefined) params.append('limit', String(options.limit))
  if (options.offset !== undefined) params.append('offset', String(options.offset))

  const queryString = params.toString()
  const endpoint = queryString ? `/task-executions?${queryString}` : '/task-executions'

  return apiGet<GetTaskExecutionsResponse>(endpoint)
}

/**
 * 個別TaskExecutionを取得する
 * GET /api/task-executions/{taskExecutionId}
 *
 * @param taskExecutionId - TaskExecution ID
 * @returns TaskExecution情報
 *
 * @example
 * ```typescript
 * const taskExecution = await getTaskExecution('uuid')
 * ```
 */
export async function getTaskExecution(
  taskExecutionId: string
): Promise<TaskExecutionResponse> {
  return apiGet<TaskExecutionResponse>(`/task-executions/${taskExecutionId}`)
}

/**
 * TaskExecutionを開始する（NOT_STARTED -> IN_PROGRESS）
 * POST /api/task-executions/{taskExecutionId}/start
 *
 * @param taskExecutionId - 開始対象のTaskExecution ID
 * @param request - 開始リクエスト（実行者のmemberIds配列）
 * @returns 更新後のTaskExecution情報
 *
 * @note この操作でTaskSnapshotが作成され、タスク定義の状態が凍結されます
 *
 * @example
 * ```typescript
 * const updated = await startTaskExecution('uuid', {
 *   memberIds: ['member-uuid-1', 'member-uuid-2']
 * })
 * console.log(updated.status) // 'IN_PROGRESS'
 * console.log(updated.taskSnapshot) // 凍結されたタスク情報
 * ```
 */
export async function startTaskExecution(
  taskExecutionId: string,
  request: StartTaskExecutionRequest
): Promise<TaskExecutionResponse> {
  return apiPost<TaskExecutionResponse, StartTaskExecutionRequest>(
    `/task-executions/${taskExecutionId}/start`,
    request
  )
}

/**
 * TaskExecutionを完了する（IN_PROGRESS -> COMPLETED）
 * POST /api/task-executions/{taskExecutionId}/complete
 *
 * @param taskExecutionId - 完了対象のTaskExecution ID
 * @param request - 完了リクエスト（空オブジェクト）
 * @returns 更新後のTaskExecution情報
 *
 * @note 完了者はバックエンドで現在の担当者から推論されます
 *
 * @example
 * ```typescript
 * const updated = await completeTaskExecution('uuid', {})
 * console.log(updated.status) // 'COMPLETED'
 * console.log(updated.completedAt) // 完了日時
 * ```
 */
export async function completeTaskExecution(
  taskExecutionId: string,
  request: CompleteTaskExecutionRequest
): Promise<TaskExecutionResponse> {
  return apiPost<TaskExecutionResponse, CompleteTaskExecutionRequest>(
    `/task-executions/${taskExecutionId}/complete`,
    request
  )
}

/**
 * TaskExecutionをキャンセルする（NOT_STARTED/IN_PROGRESS -> CANCELLED）
 * POST /api/task-executions/{taskExecutionId}/cancel
 *
 * @param taskExecutionId - キャンセル対象のTaskExecution ID
 * @returns 更新後のTaskExecution情報
 *
 * @note 終端状態（COMPLETED, CANCELLED）からはキャンセルできません
 *
 * @example
 * ```typescript
 * const updated = await cancelTaskExecution('uuid')
 * console.log(updated.status) // 'CANCELLED'
 * ```
 */
export async function cancelTaskExecution(
  taskExecutionId: string
): Promise<TaskExecutionResponse> {
  return apiPost<TaskExecutionResponse, Record<string, never>>(
    `/task-executions/${taskExecutionId}/cancel`,
    {}
  )
}

/**
 * TaskExecutionに担当者を割り当てる
 * POST /api/task-executions/{taskExecutionId}/assign
 *
 * @param taskExecutionId - 割り当て対象のTaskExecution ID
 * @param request - 割り当てリクエスト（担当者のmemberIds配列）
 * @returns 更新後のTaskExecution情報
 *
 * @note NOT_STARTED状態のタスクのみ割り当て可能
 *
 * @example
 * ```typescript
 * const updated = await assignTaskExecution('uuid', {
 *   memberIds: ['member-uuid-1', 'member-uuid-2']
 * })
 * console.log(updated.assigneeMemberIds) // ['member-uuid-1', 'member-uuid-2']
 * ```
 */
export async function assignTaskExecution(
  taskExecutionId: string,
  request: AssignTaskExecutionRequest
): Promise<TaskExecutionResponse> {
  return apiPost<TaskExecutionResponse, AssignTaskExecutionRequest>(
    `/task-executions/${taskExecutionId}/assign`,
    request
  )
}

/**
 * 指定日のTaskExecutionを一括生成する
 * POST /api/task-generations/daily/{date}
 *
 * @param targetDate - 対象日（YYYY-MM-DD形式）
 * @returns 生成されたTaskExecution IDリストと件数
 *
 * @note この操作は冪等です。同じ日付で複数回呼び出しても、
 *       既に存在するTaskExecutionは再生成されません。
 *
 * @note バックエンドは `/api/task-generations/daily/{date}` を使用しています。
 *       将来的に `/api/task-executions/generate` に統一される可能性があります。
 *       @see doc/backend-issues.md - 4. APIエンドポイントの命名不整合
 *
 * @example
 * ```typescript
 * const { generatedCount, taskExecutionIds, targetDate } = await generateTaskExecutions('2024-12-27')
 * console.log(`${generatedCount}件のタスクを生成しました`)
 * ```
 */
export async function generateTaskExecutions(
  targetDate: string
): Promise<GenerateTaskExecutionsResponse> {
  // バックエンドの実際のエンドポイントを使用
  // POST /api/task-generations/daily/{date}
  return apiPost<GenerateTaskExecutionsResponse, Record<string, never>>(
    `/task-generations/daily/${targetDate}`,
    {}
  )
}

/**
 * 当日のTaskExecutionを一括生成する
 * POST /api/task-generations/daily
 *
 * @returns 生成されたTaskExecution IDリストと件数
 *
 * @note この操作は冪等です。同じ日付で複数回呼び出しても、
 *       既に存在するTaskExecutionは再生成されません。
 *
 * @example
 * ```typescript
 * const { generatedCount, taskExecutionIds, targetDate } = await generateTodayTaskExecutions()
 * console.log(`${generatedCount}件のタスクを生成しました`)
 * ```
 */
export async function generateTodayTaskExecutions(): Promise<GenerateTaskExecutionsResponse> {
  return apiPost<GenerateTaskExecutionsResponse, Record<string, never>>(
    '/task-generations/daily',
    {}
  )
}
// NOTE: This commit adds a granular note about scheduledDate usage in the TaskExecutions API.

