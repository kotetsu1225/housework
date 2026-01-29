// ==========================================
// Member関連の型定義
// ==========================================

export type FamilyRole = 'FATHER' | 'MOTHER' | 'BROTHER' | 'SISTER'

export interface Member {
  id: string
  name: string
  email: string
  role: FamilyRole
  /** personal(owner)+assignee 母集団の総数（CANCELLED/削除済み除外） */
  totalCount?: number
  /** 上記母集団のうち、本人が完了(completedBy=本人)した件数 */
  completedCount?: number
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
  point: number // ADDED: points earned on completion
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
  frozenPoint: number // ADDED: point value frozen at task start
  capturedAt: string
}

export interface TaskExecution {
  id: string
  taskDefinitionId: string
  assigneeMemberIds: string[] // CHANGED: was assigneeMemberId (singular)
  scheduledDate: string
  status: ExecutionStatus
  taskSnapshot: TaskSnapshot
  startedAt?: string
  completedAt?: string
  // REMOVED: completedByMemberId
  createdAt: string
  updatedAt: string
}

// ==========================================
// フロントエンド用の拡張型
// ==========================================

export interface TaskExecutionWithDetails extends TaskExecution {
  assignees: Member[] // CHANGED: plural, supports multiple assignees
  // REMOVED: completedBy (use assignees instead)
}

export interface DailyTaskSummary {
  date: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  notStartedTasks: number
}
