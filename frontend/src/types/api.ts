/**
 * API Request/Response型定義
 *
 * バックエンドのPresentation層の型に対応する型定義
 * @see backend/src/main/kotlin/com/task/presentation/Members.kt
 * @see backend/src/main/kotlin/com/task/presentation/MemberAvailabilities.kt
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
  familyRole: FamilyRole
}

/**
 * メンバー作成レスポンス
 * @note バックエンド修正後に対応予定
 */
export interface CreateMemberResponse {
  id: string
  name: string
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
  members: MemberResponse[]
}

export interface MemberResponse {
  id: string
  name: string
  familyRole: FamilyRole
}

// ==========================================
// MemberAvailability API Types
// ==========================================

/**
 * 空き時間スロットリクエスト
 */
export interface TimeSlotRequest {
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  memo?: string | null
}

/**
 * 空き時間スロットレスポンス
 */
export interface TimeSlotResponse {
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  memo: string | null
}

/**
 * 空き時間作成リクエスト
 * POST /api/member-availabilities/create
 */
export interface CreateMemberAvailabilityRequest {
  memberId: string
  targetDate: string // YYYY-MM-DD format
  slots: TimeSlotRequest[]
}

/**
 * 空き時間作成レスポンス
 */
export interface CreateMemberAvailabilityResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
}

/**
 * 空き時間更新リクエスト
 * POST /api/member-availabilities/{availabilityId}/update
 */
export interface UpdateMemberAvailabilityRequest {
  slots: TimeSlotRequest[]
}

/**
 * 空き時間更新レスポンス
 */
export interface UpdateMemberAvailabilityResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
}

/**
 * 空き時間スロット削除リクエスト
 * POST /api/member-availabilities/{availabilityId}/delete-slots
 */
export interface DeleteMemberAvailabilitySlotsRequest {
  slots: TimeSlotRequest[]
}

/**
 * 空き時間スロット削除レスポンス
 */
export interface DeleteMemberAvailabilitySlotsResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
}

/**
 * メンバー別空き時間一覧取得レスポンス
 * GET /api/member-availabilities/member/{memberId}
 */
export interface GetMemberAvailabilitiesResponse {
  availabilities: MemberAvailabilityResponse[]
}

export interface MemberAvailabilityResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
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
 * タスク定義作成リクエスト
 * POST /api/task-definitions/create
 */
export interface CreateTaskDefinitionRequest {
  name: string
  description: string
  estimatedMinutes: number
  scope: 'FAMILY' | 'PERSONAL'
  ownerMemberId?: string | null
  schedule: ScheduleDto
}

/**
 * タスク定義作成レスポンス
 */
export interface CreateTaskDefinitionResponse {
  id: string
  name: string
  description: string
  estimatedMinutes: number
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
}

/**
 * タスク定義更新リクエスト
 * POST /api/task-definitions/{taskDefinitionId}/update
 */
export interface UpdateTaskDefinitionRequest {
  name?: string | null
  description?: string | null
  estimatedMinutes?: number | null
  scope?: 'FAMILY' | 'PERSONAL' | null
  ownerMemberId?: string | null
  schedule?: ScheduleDto | null
}

/**
 * タスク定義更新レスポンス
 */
export interface UpdateTaskDefinitionResponse {
  id: string
  name: string
  description: string
  estimatedMinutes: number
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
}

/**
 * タスク定義削除レスポンス
 * POST /api/task-definitions/{taskDefinitionId}/delete
 */
export interface DeleteTaskDefinitionResponse {
  id: string
  name: string
  description: string
  estimatedMinutes: number
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
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
  estimatedMinutes: number
  scope: string
  ownerMemberId?: string | null
  schedule: ScheduleDto
  version: number
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

