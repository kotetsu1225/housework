package com.task.usecase.query.dashboard

import java.time.LocalDate

/**
 * ダッシュボード画面用QueryService
 *
 * 複数集約（TaskExecution, TaskDefinition, Member, MemberAvailability）を
 * JOINして取得する参照専用サービス
 *
 * CQRSパターン: 参照系モデルとして、画面に最適化されたDTOを返す
 */
interface DashboardQueryService {

    data class Input(
        val targetDate: LocalDate
    )

    data class Output(
        val todayTasks: List<TodayTaskDto>,
        val memberSummaries: List<MemberTaskSummaryDto>,
        val memberAvailabilities: List<MemberAvailabilityTodayDto>
    )

    fun fetchDashboardData(input: Input): Output
}

/**
 * 今日のタスク一覧DTO
 * TaskExecution + TaskDefinition をJOINして取得
 */
data class TodayTaskDto(
    val taskExecutionId: String,
    val taskDefinitionId: String,
    val taskName: String,           // TaskDefinition.name
    val taskDescription: String?,   // TaskDefinition.description
    val scheduledStartTime: String, // ISO-8601形式
    val scheduledEndTime: String,   // ISO-8601形式
    val scope: String,              // TaskDefinition.scope (FAMILY/PERSONAL)
    val scheduleType: String,       // TaskDefinition.schedule_type (RECURRING/ONE_TIME)
    val status: String,             // TaskExecution.status
    val ownerMemberId: String?,     // TaskDefinition.owner_member_id (PERSONAL only)
    val assigneeMemberId: String?,
    val assigneeMemberName: String?,
    val scheduledDate: String
)

/**
 * メンバーごとのタスクサマリーDTO
 */
data class MemberTaskSummaryDto(
    val memberId: String,
    val memberName: String,
    val familyRole: String,
    val completedCount: Int,
    val totalCount: Int,
    val tasks: List<MemberTaskDto>  // そのメンバーのタスク一覧
)

/**
 * メンバーの個別タスクDTO
 */
data class MemberTaskDto(
    val taskExecutionId: String,
    val taskName: String,
    val status: String
)

/**
 * メンバーの本日の空き時間DTO
 */
data class MemberAvailabilityTodayDto(
    val memberId: String,
    val memberName: String,
    val familyRole: String,
    val slots: List<TimeSlotDto>
)

/**
 * 時間スロットDTO
 */
data class TimeSlotDto(
    val startTime: String,  // HH:mm
    val endTime: String,
    val memo: String?
)

