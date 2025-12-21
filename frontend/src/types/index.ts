// ==========================================
// Member関連の型定義
// ==========================================

export type FamilyRole = 'FATHER' | 'MOTHER' | 'BROTHER' | 'SISTER'

export interface Member {
  id: string
  name: string
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
  role: FamilyRole
  createdAt: string
}

export interface TimeSlot {
  id: string
  memberId: string
  targetDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  memo?: string
}

// ==========================================
// TaskDefinition関連の型定義
// ==========================================

export type TaskScope = 'FAMILY' | 'PERSONAL'
export type ScheduleType = 'RECURRING' | 'ONE_TIME'
export type PatternType = 'DAILY' | 'WEEKLY' | 'MONTHLY'

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
  estimatedMinutes: number
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
  estimatedMinutes: number
  definitionVersion: number
  createdAt: string
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
