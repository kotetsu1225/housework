// ==========================================
// Member関連の型定義
// ==========================================

export type FamilyRole = 'FATHER' | 'MOTHER' | 'BROTHER' | 'SISTER'

export interface Member {
  id: string
  name: string
  email: string
  role: FamilyRole
  createdAt: string
  updatedAt: string
}

// ==========================================
// 認証関連の型定義
// ==========================================

export interface User {
  id: string
  name: string
  email: string
  role: FamilyRole
  createdAt: string
}

// ==========================================
// MemberAvailability関連の型定義
// ==========================================

/**
 * 空き時間スロット（バックエンド構造に準拠）
 * @see backend/src/main/kotlin/com/task/domain/memberAvailability/MemberAvailability.kt
 */
export interface TimeSlot {
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  memo?: string | null
}

/**
 * メンバー空き時間（バックエンド構造に準拠）
 * 1つの日付に対する空き時間スロットのコレクション
 */
export interface MemberAvailability {
  id: string
  memberId: string
  targetDate: string // YYYY-MM-DD format
  slots: TimeSlot[]
}

/**
 * フラット化された時間スロット（UI表示用）
 * MemberAvailabilityをフラットなリストとして扱う場合に使用
 */
export interface FlatTimeSlot {
  availabilityId: string
  memberId: string
  targetDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  memo?: string | null
}

// ==========================================
// TaskDefinition関連の型定義
// ==========================================

export type TaskScope = 'FAMILY' | 'PERSONAL'
export type ScheduleType = 'RECURRING' | 'ONE_TIME'
export type PatternType = 'DAILY' | 'WEEKLY' | 'MONTHLY'

/**
 * 予定時間帯
 */
export interface ScheduledTimeRange {
  /** 予定開始時刻（ISO8601形式） */
  startTime: string
  /** 予定終了時刻（ISO8601形式） */
  endTime: string
}

export interface RecurrencePattern {
  patternType: PatternType
  dailySkipWeekends?: boolean
  weeklyDayOfWeek?: number // 1-7 (月-日)
  monthlyDayOfMonth?: number // 1-31
  startDate: string
  endDate?: string
}

export interface TaskDefinition {
  id: string
  name: string
  description?: string
  scheduledTimeRange: ScheduledTimeRange
  scope: TaskScope
  ownerMemberId?: string
  scheduleType: ScheduleType
  oneTimeDeadline?: string
  recurrence?: RecurrencePattern
  version: number
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

// ==========================================
// TaskExecution関連の型定義
// ==========================================

export type ExecutionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface TaskSnapshot {
  name: string
  description?: string
  scheduledStartTime: string
  scheduledEndTime: string
  definitionVersion: number
  capturedAt: string
}

export interface TaskExecution {
  id: string
  taskDefinitionId: string
  assigneeMemberId?: string
  scheduledDate: string
  status: ExecutionStatus
  taskSnapshot: TaskSnapshot
  startedAt?: string
  completedAt?: string
  completedByMemberId?: string
  createdAt: string
  updatedAt: string
}

// ==========================================
// フロントエンド用の拡張型
// ==========================================

export interface TaskExecutionWithDetails extends TaskExecution {
  assignee?: Member
  completedBy?: Member
}

export interface DailyTaskSummary {
  date: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  notStartedTasks: number
}
