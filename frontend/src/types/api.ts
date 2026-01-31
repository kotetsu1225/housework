/**
 * API Request/Response型定義
 *
 * バックエンドのPresentation層の型に対応する型定義
 * @see backend/src/main/kotlin/com/task/presentation/Members.kt
 */

import type { FamilyRole } from './index'

// ==========================================
// Member API Types
// ==========================================

/**
 * メンバー作成リクエスト
 * POST /api/member/create
 */
export interface CreateMemberRequest {
  name: string
  email: string
  familyRole: FamilyRole
  password: string
}

/**
 * メンバー作成レスポンス
 */
export interface CreateMemberResponse {
  id: string
  name: string
  email: string
  familyRole: FamilyRole
}

/**
 * メンバー更新リクエスト
 * POST /api/member/{memberId}/update
 * @note nameとfamilyRoleはnullable（部分更新対応）
 */
export interface UpdateMemberRequest {
  name?: string | null
  familyRole?: FamilyRole | null
}

/**
 * メンバー更新レスポンス
 * @note バックエンド修正後に対応予定
 */
export interface UpdateMemberResponse {
  id: string
  name: string
  familyRole: FamilyRole
}

/**
 * メンバー一覧取得レスポンス
 * GET /api/member
 * @note バックエンドにエンドポイント追加後に対応予定
 */
export interface GetMembersResponse {
  members: MemberListItemResponse[]
}

export interface MemberResponse {
  id: string
  name: string
  email: string
  familyRole: FamilyRole
}

/**
 * メンバー一覧用の要約レスポンス
 */
export interface MemberListItemResponse extends MemberResponse {
  /** 今日獲得したポイント */
  todayEarnedPoint: number
  /** 今日の完了済み家族タスク合計 */
  todayFamilyTaskCompletedTotal: number
  /** 今日の完了済み家族タスクのうち担当分 */
  todayFamilyTaskCompleted: number
  /** 今日の完了済み個人タスク数 */
  todayPersonalTaskCompleted: number
}

// ==========================================
// Auth API Types
// ==========================================

/**
 * ログインリクエスト
 * POST /api/auth/login
 * @see backend/src/main/kotlin/com/task/presentation/Auth.kt
 */
export interface LoginRequest {
  name: string
  password: string
}

/**
 * ログインレスポンス
 */
export interface LoginResponse {
  token: string
  memberName: string
}

/**
 * 新規登録リクエスト
 * POST /api/auth/register
 * @see backend/src/main/kotlin/com/task/presentation/Auth.kt
 */
export interface RegisterRequest {
  name: string
  email: string
  familyRole: FamilyRole
  password: string
}

/**
 * 新規登録レスポンス
 */
export interface RegisterResponse {
  token: string
  memberName: string
}

// ==========================================
// TaskDefinition API Types
// ==========================================

/**
 * スケジュールDTO（バックエンドのSealed Classに対応）
 * @see backend/src/main/kotlin/com/task/presentation/TaskDefinitions.kt
 */
export type ScheduleDto = RecurringScheduleDto | OneTimeScheduleDto

export interface RecurringScheduleDto {
  type: 'Recurring'
  pattern: PatternDto
  startDate: string // YYYY-MM-DD format
  endDate?: string | null
}

export interface OneTimeScheduleDto {
  type: 'OneTime'
  deadline: string // YYYY-MM-DD format
}

/**
 * パターンDTO（バックエンドのSealed Classに対応）
 */
export type PatternDto = DailyPatternDto | WeeklyPatternDto | MonthlyPatternDto

export interface DailyPatternDto {
  type: 'Daily'
  skipWeekends: boolean
}

export interface WeeklyPatternDto {
  type: 'Weekly'
  dayOfWeek: string // MONDAY, TUESDAY, etc.
}

export interface MonthlyPatternDto {
  type: 'Monthly'
  dayOfMonth: number // 1-28
}

/**
 * 予定時間帯DTO
 * @see backend/src/main/kotlin/com/task/presentation/TaskDefinitions.kt
 */
export interface ScheduledTimeRangeDto {
  /** 予定開始時刻（ISO8601形式: 2025-01-01T09:00:00Z） */
  startTime: string
  /** 予定終了時刻（ISO8601形式: 2025-01-01T10:00:00Z） */
  endTime: string
}

/**
 * タスク定義作成リクエスト
 * POST /api/task-definitions/create
 */
export interface CreateTaskDefinitionRequest {
  name: string
  description: string
  scheduledTimeRange: ScheduledTimeRangeDto
  scope: 'FAMILY' | 'PERSONAL'
  ownerMemberId?: string | null
  schedule: ScheduleDto
  point: number // ADDED: points earned on completion
}

/**
 * タスク定義作成レスポンス
 */
export interface CreateTaskDefinitionResponse {
  id: string
  name: string
  description: string
  scheduledTimeRange: ScheduledTimeRangeDto
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
  point: number // ADDED
}

/**
 * タスク定義更新リクエスト
 * POST /api/task-definitions/{taskDefinitionId}/update
 */
export interface UpdateTaskDefinitionRequest {
  name?: string | null
  description?: string | null
  scheduledTimeRange?: ScheduledTimeRangeDto | null
  scope?: 'FAMILY' | 'PERSONAL' | null
  ownerMemberId?: string | null
  schedule?: ScheduleDto | null
  point?: number | null // ADDED: null means "don't change"
}

/**
 * タスク定義更新レスポンス
 */
export interface UpdateTaskDefinitionResponse {
  id: string
  name: string
  description: string
  scheduledTimeRange: ScheduledTimeRangeDto
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
  point: number // ADDED
}

/**
 * タスク定義削除レスポンス
 * POST /api/task-definitions/{taskDefinitionId}/delete
 */
export interface DeleteTaskDefinitionResponse {
  id: string
  name: string
  description: string
  scheduledTimeRange: ScheduledTimeRangeDto
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
  point: number // ADDED
}

/**
 * タスク定義一覧取得レスポンス
 * GET /api/task-definitions
 */
export interface GetTaskDefinitionsResponse {
  taskDefinitions: TaskDefinitionResponse[]
  total: number
  hasMore: boolean
}

export interface TaskDefinitionResponse {
  id: string
  name: string
  description: string
  scheduledTimeRange: ScheduledTimeRangeDto
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
  point: number // ADDED
}

// ==========================================
// TaskExecution API Types
// ==========================================

/**
 * TaskExecution一覧取得レスポンス
 * GET /api/task-executions
 * @see doc/task-execution-api.md
 */
export interface GetTaskExecutionsResponse {
  taskExecutions: TaskExecutionResponse[]
  total: number
  hasMore: boolean
}

/**
 * TaskExecutionレスポンス
 * 単一取得・一覧取得の共通型
 */
export interface TaskExecutionResponse {
  id: string
  taskDefinitionId: string
  assigneeMemberIds: string[] // CHANGED: was assigneeMemberId (singular)
  scheduledDate: string // YYYY-MM-DD format
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  taskSnapshot: TaskSnapshotResponse | null // NOT_STARTEDの場合はnull
  startedAt: string | null // ISO8601 format
  completedAt: string | null
  // REMOVED: completedByMemberId
  createdAt: string
  updatedAt: string
}

/**
 * TaskSnapshotレスポンス
 * タスク開始時点の凍結情報
 */
export interface TaskSnapshotResponse {
  name: string
  description: string | null
  scheduledStartTime: string
  scheduledEndTime: string
  definitionVersion: number
  frozenPoint: number // ADDED: point value frozen at task start
  capturedAt: string
}

/**
 * TaskExecution開始リクエスト
 * POST /api/task-executions/{id}/start
 */
export interface StartTaskExecutionRequest {
  memberIds: string[] // CHANGED: was memberId (singular)
}

/**
 * TaskExecution完了リクエスト
 * POST /api/task-executions/{id}/complete
 * @note Backend derives completedBy from current assignees
 */
export interface CompleteTaskExecutionRequest {
  // REMOVED: memberId field - backend infers from assignees
}

/**
 * TaskExecution担当者割り当てリクエスト
 * POST /api/task-executions/{id}/assign
 */
export interface AssignTaskExecutionRequest {
  memberIds: string[] // CHANGED: was memberId (singular)
}

/**
 * TaskExecution一括生成レスポンス
 * POST /api/task-generations/daily または POST /api/task-generations/daily/{date}
 *
 * @note バックエンドは `/api/task-generations/` エンドポイントを使用しています。
 *       @see doc/backend-issues.md - 4. APIエンドポイントの命名不整合
 * @see backend/src/main/kotlin/com/task/presentation/TaskGenerations.kt
 */
export interface GenerateTaskExecutionsResponse {
  /** 生成されたTaskExecutionの件数 */
  generatedCount: number
  /** 生成されたTaskExecutionのID一覧 */
  taskExecutionIds: string[]
  /** 対象日（YYYY-MM-DD形式） */
  targetDate: string
}

// ==========================================
// Error Types
// ==========================================

/**
 * APIエラーレスポンス
 * @see backend/src/main/kotlin/com/task/Application.kt StatusPages設定
 */
export interface ApiErrorResponse {
  error: string
}
