package com.task.presentation

import com.task.usecase.query.dashboard.DashboardQueryService
import com.task.usecase.query.dashboard.MemberAvailabilityTodayDto
import com.task.usecase.query.dashboard.MemberTaskDto
import com.task.usecase.query.dashboard.MemberTaskSummaryDto
import com.task.usecase.query.dashboard.TimeSlotDto
import com.task.usecase.query.dashboard.TodayTaskDto
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.resources.get
import kotlinx.serialization.Serializable
import java.time.LocalDate

@Resource("api/dashboard")
class Dashboard {

    @Resource("")
    class Get(
        val parent: Dashboard = Dashboard(),
        val date: String? = null  // YYYY-MM-DD形式、デフォルトは今日
    )
}

/**
 * ダッシュボードAPIレスポンス
 */
@Serializable
data class DashboardResponse(
    val todayTasks: List<TodayTaskResponse>,
    val memberSummaries: List<MemberTaskSummaryResponse>,
    val memberAvailabilities: List<MemberAvailabilityTodayResponse>
)

@Serializable
data class TodayTaskResponse(
    val taskExecutionId: String,
    val taskDefinitionId: String,
    val taskName: String,
    val taskDescription: String?,
    val estimatedMinutes: Int,
    val scope: String,
    val status: String,
    val assigneeMemberId: String?,
    val assigneeMemberName: String?,
    val scheduledDate: String
)

@Serializable
data class MemberTaskSummaryResponse(
    val memberId: String,
    val memberName: String,
    val familyRole: String,
    val completedCount: Int,
    val totalCount: Int,
    val tasks: List<MemberTaskResponse>
)

@Serializable
data class MemberTaskResponse(
    val taskExecutionId: String,
    val taskName: String,
    val status: String
)

@Serializable
data class MemberAvailabilityTodayResponse(
    val memberId: String,
    val memberName: String,
    val familyRole: String,
    val slots: List<TimeSlotResponse>
)

@Serializable
data class TimeSlotResponse(
    val startTime: String,
    val endTime: String,
    val memo: String?
)

/**
 * DTOをレスポンスに変換
 */
private fun TodayTaskDto.toResponse() = TodayTaskResponse(
    taskExecutionId = taskExecutionId,
    taskDefinitionId = taskDefinitionId,
    taskName = taskName,
    taskDescription = taskDescription,
    estimatedMinutes = estimatedMinutes,
    scope = scope,
    status = status,
    assigneeMemberId = assigneeMemberId,
    assigneeMemberName = assigneeMemberName,
    scheduledDate = scheduledDate
)

private fun MemberTaskDto.toResponse() = MemberTaskResponse(
    taskExecutionId = taskExecutionId,
    taskName = taskName,
    status = status
)

private fun MemberTaskSummaryDto.toResponse() = MemberTaskSummaryResponse(
    memberId = memberId,
    memberName = memberName,
    familyRole = familyRole,
    completedCount = completedCount,
    totalCount = totalCount,
    tasks = tasks.map { it.toResponse() }
)

private fun TimeSlotDto.toResponse() = TimeSlotResponse(
    startTime = startTime,
    endTime = endTime,
    memo = memo
)

private fun MemberAvailabilityTodayDto.toResponse() = MemberAvailabilityTodayResponse(
    memberId = memberId,
    memberName = memberName,
    familyRole = familyRole,
    slots = slots.map { it.toResponse() }
)

/**
 * ダッシュボードAPIルート
 *
 * GET /api/dashboard?date=YYYY-MM-DD
 * - date: 対象日（省略時は今日）
 *
 * CQRSパターン: DashboardQueryServiceを使用して複数集約のデータを取得
 */
fun Route.dashboard() {
    get<Dashboard.Get> { resource ->
        val targetDate = resource.date?.let { LocalDate.parse(it) } ?: LocalDate.now()

        val output = instance<DashboardQueryService>().fetchDashboardData(
            DashboardQueryService.Input(targetDate = targetDate)
        )

        call.respond(
            HttpStatusCode.OK,
            DashboardResponse(
                todayTasks = output.todayTasks.map { it.toResponse() },
                memberSummaries = output.memberSummaries.map { it.toResponse() },
                memberAvailabilities = output.memberAvailabilities.map { it.toResponse() }
            )
        )
    }
}

