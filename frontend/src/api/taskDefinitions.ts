/**
 * TaskDefinition API関数
 *
 * タスク定義関連のAPI呼び出しを提供
 * @see backend/src/main/kotlin/com/task/presentation/TaskDefinitions.kt
 */

import { apiPost } from './client'
import type {
  CreateTaskDefinitionRequest,
  CreateTaskDefinitionResponse,
  UpdateTaskDefinitionRequest,
  UpdateTaskDefinitionResponse,
  DeleteTaskDefinitionResponse,
} from '../types/api'

/**
 * タスク定義を作成する
 *
 * @param request - 作成リクエスト
 * @returns 作成されたタスク定義情報
 *
 * @example
 * ```typescript
 * const taskDef = await createTaskDefinition({
 *   name: 'お風呂掃除',
 *   description: '浴槽と床を洗う',
 *   estimatedMinutes: 15,
 *   scope: 'FAMILY',
 *   schedule: {
 *     type: 'Recurring',
 *     pattern: { type: 'Daily', skipWeekends: false },
 *     startDate: '2024-01-01'
 *   }
 * })
 * ```
 */
export async function createTaskDefinition(
  request: CreateTaskDefinitionRequest
): Promise<CreateTaskDefinitionResponse> {
  return apiPost<CreateTaskDefinitionResponse, CreateTaskDefinitionRequest>(
    '/task-definitions/create',
    request
  )
}

/**
 * タスク定義を更新する
 *
 * @param taskDefinitionId - 更新対象のタスク定義ID
 * @param request - 更新リクエスト（部分更新対応）
 * @returns 更新されたタスク定義情報
 *
 * @example
 * ```typescript
 * const taskDef = await updateTaskDefinition('uuid', {
 *   name: '新しい名前',
 *   estimatedMinutes: 30
 * })
 * ```
 */
export async function updateTaskDefinition(
  taskDefinitionId: string,
  request: UpdateTaskDefinitionRequest
): Promise<UpdateTaskDefinitionResponse> {
  return apiPost<UpdateTaskDefinitionResponse, UpdateTaskDefinitionRequest>(
    `/task-definitions/${taskDefinitionId}/update`,
    request
  )
}

/**
 * タスク定義を削除する（論理削除）
 *
 * @param taskDefinitionId - 削除対象のタスク定義ID
 * @returns 削除されたタスク定義情報
 *
 * @example
 * ```typescript
 * const taskDef = await deleteTaskDefinition('uuid')
 * ```
 */
export async function deleteTaskDefinition(
  taskDefinitionId: string
): Promise<DeleteTaskDefinitionResponse> {
  return apiPost<DeleteTaskDefinitionResponse, Record<string, never>>(
    `/task-definitions/${taskDefinitionId}/delete`,
    {}
  )
}

/**
 * タスク定義一覧を取得する
 *
 * @note バックエンドにGETエンドポイントが存在しないため、現在は使用不可
 * @see docs/BACKEND_ISSUES.md - GETエンドポイントの欠如
 */
// export async function getTaskDefinitions(): Promise<TaskDefinitionResponse[]> {
//   return apiGet<TaskDefinitionResponse[]>('/task-definitions')
// }

/**
 * 個別タスク定義を取得する
 *
 * @note バックエンドにGETエンドポイントが存在しないため、現在は使用不可
 * @see docs/BACKEND_ISSUES.md - GETエンドポイントの欠如
 */
// export async function getTaskDefinition(taskDefinitionId: string): Promise<TaskDefinitionResponse> {
//   return apiGet<TaskDefinitionResponse>(`/task-definitions/${taskDefinitionId}`)
// }

