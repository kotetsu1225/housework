package com.task.presentation

import com.task.usecase.execution.GetCompletedTasksUseCase
import com.task.usecase.query.execution.AssigneeMemberDto
import com.task.usecase.query.execution.CompletedTaskDto
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.resources.get
import kotlinx.serialization.Serializable
import java.time.LocalDate

@Resource("api/completed-tasks")
class CompletedTasks {

    @Resource("")
    class Get(
        val parent: CompletedTasks = CompletedTasks(),
        /** 担当者IDでフィルタ（カンマ区切り） */
        val memberIds: String? = null,
        /** 日付でフィルタ（YYYY-MM-DD形式） */
        val date: String? = null,
        /** 取得件数（デフォルト: 50） */
        val limit: Int = 50,
        /** オフセット（デフォルト: 0） */
        val offset: Int = 0
    )
}

/**
 * 完了タスク一覧APIレスポンス
 */
@Serializable
data class CompletedTasksResponse(
    val completedTasks: List<CompletedTaskResponse>,
    val hasMore: Boolean
)

@Serializable
data class CompletedTaskResponse(
    val taskExecutionId: String,
    val taskDefinitionId: String,
    val name: String,
    val description: String?,
    val scheduledStartTime: String,
    val scheduledEndTime: String,
    val frozenPoint: Int,
    val definitionVersion: Int,
    val scope: String,
    val scheduleType: String,
    val ownerMemberId: String?,
    val assigneeMembers: List<AssigneeMemberResponse>,
    val scheduledDate: String,
    val completedAt: String
)

@Serializable
data class AssigneeMemberResponse(
    val id: String,
    val name: String
)

/**
 * DTOをレスポンスに変換
 */
private fun AssigneeMemberDto.toResponse() = AssigneeMemberResponse(
    id = id,
    name = name
)

private fun CompletedTaskDto.toResponse() = CompletedTaskResponse(
    taskExecutionId = taskExecutionId,
    taskDefinitionId = taskDefinitionId,
    name = name,
    description = description,
    scheduledStartTime = scheduledStartTime,
    scheduledEndTime = scheduledEndTime,
    frozenPoint = frozenPoint,
    definitionVersion = definitionVersion,
    scope = scope,
    scheduleType = scheduleType,
    ownerMemberId = ownerMemberId,
    assigneeMembers = assigneeMembers.map { it.toResponse() },
    scheduledDate = scheduledDate,
    completedAt = completedAt
)

/**
 * 完了タスク一覧APIルート
 *
 * GET /api/completed-tasks?memberIds=xxx,yyy&date=YYYY-MM-DD&limit=50&offset=0
 * - memberIds: 担当者IDでフィルタ（カンマ区切り、省略時は全員）
 * - date: 日付でフィルタ（省略時は全期間）
 * - limit: 取得件数（デフォルト: 50）
 * - offset: オフセット（デフォルト: 0）
 */
fun Route.completedTasks() {
    get<CompletedTasks.Get> { resource ->
        val memberIdList = resource.memberIds
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }

        val date = resource.date?.let { LocalDate.parse(it) }

        val output = instance<GetCompletedTasksUseCase>().execute(
            GetCompletedTasksUseCase.Input(
                memberIds = memberIdList,
                date = date,
                limit = resource.limit,
                offset = resource.offset
            )
        )

        call.respond(
            HttpStatusCode.OK,
            CompletedTasksResponse(
                completedTasks = output.completedTasks.map { it.toResponse() },
                hasMore = output.hasMore
            )
        )
    }
}
