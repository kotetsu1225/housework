package com.task.presentation

import com.task.domain.member.MemberId
import com.task.domain.taskExecution.TaskExecutionId
import com.task.usecase.taskExecution.assign.AssignTaskExecutionUseCase
import com.task.usecase.taskExecution.cancel.CancelTaskExecutionUseCase
import com.task.usecase.taskExecution.complete.CompleteTaskExecutionUseCase
import com.task.usecase.taskExecution.get.GetTaskExecutionUseCase
import com.task.usecase.taskExecution.get.GetTaskExecutionsUseCase
import com.task.usecase.taskExecution.start.StartTaskExecutionUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

@Resource("api/task-executions")
class TaskExecutions {

    @Resource("")
    class List(
        val parent: TaskExecutions = TaskExecutions(),
        val limit: Int = 20,
        val offset: Int = 0,
        val scheduledDate: String? = null,  // YYYY-MM-DD形式
        val status: String? = null,         // NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED
        val assigneeMemberId: String? = null // UUID形式
    )

    @Resource("/{taskExecutionId}")
    class Get(
        val parent: TaskExecutions = TaskExecutions(),
        val taskExecutionId: String
    )

    @Resource("/{taskExecutionId}/start")
    class Start(
        val parent: TaskExecutions = TaskExecutions(),
        val taskExecutionId: String
    ) {
        @Serializable
        data class Request(
            val memberId: String
        )
    }

    @Resource("/{taskExecutionId}/complete")
    class Complete(
        val parent: TaskExecutions = TaskExecutions(),
        val taskExecutionId: String
    ) {
        @Serializable
        data class Request(
            val memberId: String
        )
    }

    @Resource("/{taskExecutionId}/cancel")
    class Cancel(
        val parent: TaskExecutions = TaskExecutions(),
        val taskExecutionId: String
    )

    @Resource("/{taskExecutionId}/assign")
    class Assign(
        val parent: TaskExecutions = TaskExecutions(),
        val taskExecutionId: String
    ) {
        @Serializable
        data class Request(
            val memberId: String
        )
    }
}

@Serializable
data class TaskExecutionDto(
    val id: String,
    val taskDefinitionId: String,
    val assigneeMemberId: String?,
    val scheduledDate: String,
    val status: String,
    val taskSnapshot: TaskSnapshotDto?,
    val startedAt: String?,
    val completedAt: String?,
    val completedByMemberId: String?
)

@Serializable
data class TaskSnapshotDto(
    val name: String,
    val description: String?,
    val scheduledStartTime: String,
    val scheduledEndTime: String,
    val definitionVersion: Int,
    val capturedAt: String
)

@Serializable
data class GetTaskExecutionsResponse(
    val taskExecutions: kotlin.collections.List<TaskExecutionDto>,
    val total: Int,
    val hasMore: Boolean
)

private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.systemDefault())
private val instantFormatter = DateTimeFormatter.ISO_INSTANT

fun Route.taskExecutions() {

    get<TaskExecutions.List> { resource ->
        // クエリパラメータからFilterSpecを構築
        val filter = GetTaskExecutionsUseCase.FilterSpec(
            scheduledDate = resource.scheduledDate?.let { LocalDate.parse(it) },
            status = resource.status,
            assigneeMemberId = resource.assigneeMemberId?.let { MemberId(UUID.fromString(it)) }
        )

        val output = instance<GetTaskExecutionsUseCase>().execute(
            GetTaskExecutionsUseCase.Input(
                limit = resource.limit,
                offset = resource.offset,
                filter = filter
            )
        )

        val taskExecutions = output.items.map { item ->
            TaskExecutionDto(
                id = item.id.value.toString(),
                taskDefinitionId = item.taskDefinitionId.value.toString(),
                assigneeMemberId = item.assigneeMemberId?.value?.toString(),
                scheduledDate = dateFormatter.format(item.scheduledDate),
                status = item.status,
                taskSnapshot = item.snapshot?.let { snapshot ->
                    TaskSnapshotDto(
                        name = snapshot.name,
                        description = snapshot.description,
                        scheduledStartTime = instantFormatter.format(snapshot.scheduledStartTime),
                        scheduledEndTime = instantFormatter.format(snapshot.scheduledEndTime),
                        definitionVersion = snapshot.definitionVersion,
                        capturedAt = instantFormatter.format(snapshot.capturedAt)
                    )
                },
                startedAt = item.startedAt?.let { instantFormatter.format(it) },
                completedAt = item.completedAt?.let { instantFormatter.format(it) },
                completedByMemberId = item.completedByMemberId?.value?.toString()
            )
        }

        call.respond(
            HttpStatusCode.OK,
            GetTaskExecutionsResponse(
                taskExecutions = taskExecutions,
                total = output.totalCount,
                hasMore = output.totalCount > resource.offset + resource.limit
            )
        )
    }

    get<TaskExecutions.Get> { resource ->
        val output = instance<GetTaskExecutionUseCase>().execute(
            GetTaskExecutionUseCase.Input(
                id = TaskExecutionId.from(resource.taskExecutionId)
            )
        )

        if (output == null) {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "TaskExecution not found"))
            return@get
        }

        call.respond(
            HttpStatusCode.OK,
            TaskExecutionDto(
                id = output.id.value.toString(),
                taskDefinitionId = output.taskDefinitionId.value.toString(),
                assigneeMemberId = output.assigneeMemberId?.value?.toString(),
                scheduledDate = dateFormatter.format(output.scheduledDate),
                status = output.status,
                taskSnapshot = output.snapshot?.let { snapshot ->
                    TaskSnapshotDto(
                        name = snapshot.name,
                        description = snapshot.description,
                        scheduledStartTime = instantFormatter.format(snapshot.scheduledStartTime),
                        scheduledEndTime = instantFormatter.format(snapshot.scheduledEndTime),
                        definitionVersion = snapshot.definitionVersion,
                        capturedAt = instantFormatter.format(snapshot.capturedAt)
                    )
                },
                startedAt = output.startedAt?.let { instantFormatter.format(it) },
                completedAt = output.completedAt?.let { instantFormatter.format(it) },
                completedByMemberId = output.completedByMemberId?.value?.toString()
            )
        )
    }

    post<TaskExecutions.Start> { resource ->
        val request = call.receive<TaskExecutions.Start.Request>()

        val output = instance<StartTaskExecutionUseCase>().execute(
            StartTaskExecutionUseCase.Input(
                id = TaskExecutionId.from(resource.taskExecutionId),
                assigneeMemberId = MemberId(UUID.fromString(request.memberId))
            )
        )

        call.respond(
            HttpStatusCode.OK,
            TaskExecutionDto(
                id = output.id.value.toString(),
                taskDefinitionId = output.taskDefinitionId.value.toString(),
                assigneeMemberId = output.assigneeMemberId.value.toString(),
                scheduledDate = dateFormatter.format(output.scheduledDate),
                status = "IN_PROGRESS",
                taskSnapshot = TaskSnapshotDto(
                    name = output.taskSnapshot.frozenName.value,
                    description = output.taskSnapshot.frozenDescription.value,
                    scheduledStartTime = instantFormatter.format(output.taskSnapshot.frozenScheduledTimeRange.startTime),
                    scheduledEndTime = instantFormatter.format(output.taskSnapshot.frozenScheduledTimeRange.endTime),
                    definitionVersion = output.taskSnapshot.definitionVersion,
                    capturedAt = instantFormatter.format(output.taskSnapshot.capturedAt)
                ),
                startedAt = instantFormatter.format(output.startedAt),
                completedAt = null,
                completedByMemberId = null
            )
        )
    }

    post<TaskExecutions.Complete> { resource ->
        val request = call.receive<TaskExecutions.Complete.Request>()

        val output = instance<CompleteTaskExecutionUseCase>().execute(
            CompleteTaskExecutionUseCase.Input(
                id = TaskExecutionId.from(resource.taskExecutionId),
                completedMemberId = MemberId(UUID.fromString(request.memberId))
            )
        )

        call.respond(
            HttpStatusCode.OK,
            TaskExecutionDto(
                id = output.id.value.toString(),
                taskDefinitionId = output.taskDefinitionId.value.toString(),
                assigneeMemberId = output.assigneeMemberId.value.toString(),
                scheduledDate = dateFormatter.format(output.scheduledDate),
                status = "COMPLETED",
                taskSnapshot = TaskSnapshotDto(
                    name = output.taskSnapshot.frozenName.value,
                    description = output.taskSnapshot.frozenDescription.value,
                    scheduledStartTime = instantFormatter.format(output.taskSnapshot.frozenScheduledTimeRange.startTime),
                    scheduledEndTime = instantFormatter.format(output.taskSnapshot.frozenScheduledTimeRange.endTime),
                    definitionVersion = output.taskSnapshot.definitionVersion,
                    capturedAt = instantFormatter.format(output.taskSnapshot.capturedAt)
                ),
                startedAt = instantFormatter.format(output.startedAt),
                completedAt = instantFormatter.format(output.completedAt),
                completedByMemberId = output.completedMemberId.value.toString()
            )
        )
    }

    post<TaskExecutions.Cancel> { resource ->
        val output = instance<CancelTaskExecutionUseCase>().execute(
            CancelTaskExecutionUseCase.Input(
                id = TaskExecutionId.from(resource.taskExecutionId)
            )
        )

        call.respond(
            HttpStatusCode.OK,
            mapOf(
                "id" to output.id.value.toString(),
                "taskDefinitionId" to output.taskDefinitionId.value.toString(),
                "scheduledDate" to dateFormatter.format(output.scheduleDate),
                "status" to "CANCELLED"
            )
        )
    }

    post<TaskExecutions.Assign> { resource ->
        val request = call.receive<TaskExecutions.Assign.Request>()

        val output = instance<AssignTaskExecutionUseCase>().execute(
            AssignTaskExecutionUseCase.Input(
                id = TaskExecutionId.from(resource.taskExecutionId),
                newAssigneeMemberId = MemberId(UUID.fromString(request.memberId))
            )
        )

        call.respond(
            HttpStatusCode.OK,
            TaskExecutionDto(
                id = output.id.value.toString(),
                taskDefinitionId = output.taskDefinitionId.value.toString(),
                assigneeMemberId = output.assigneeMemberId?.value?.toString(),
                scheduledDate = dateFormatter.format(output.scheduledDate),
                status = output.status,
                taskSnapshot = output.snapshot?.let { snapshot ->
                    TaskSnapshotDto(
                        name = snapshot.name,
                        description = snapshot.description,
                        scheduledStartTime = instantFormatter.format(snapshot.scheduledStartTime),
                        scheduledEndTime = instantFormatter.format(snapshot.scheduledEndTime),
                        definitionVersion = snapshot.definitionVersion,
                        capturedAt = instantFormatter.format(snapshot.capturedAt)
                    )
                },
                startedAt = output.startedAt?.let { instantFormatter.format(it) },
                completedAt = output.completedAt?.let { instantFormatter.format(it) },
                completedByMemberId = output.completedByMemberId?.value?.toString()
            )
        )
    }
}
