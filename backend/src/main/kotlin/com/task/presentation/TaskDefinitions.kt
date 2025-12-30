package com.task.presentation

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*
import com.task.usecase.taskDefinition.create.CreateTaskDefinitionUseCase
import com.task.usecase.taskDefinition.delete.DeleteTaskDefinitionUseCase
import com.task.usecase.taskDefinition.get.GetTaskDefinitionUseCase
import com.task.usecase.taskDefinition.get.GetTaskDefinitionsUseCase
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
// Ktor Resources: Type-safe routingを使用する場合は、
// io.ktor.server.resources.get/postを使用する必要がある
// 出典: https://ktor.io/docs/server-resources.html#routes
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Resource("api/task-definitions")
class TaskDefinitions {
    @Resource("")
    class List(
        val parent: TaskDefinitions = TaskDefinitions(),
        val limit: Int = 20,
        val offset: Int = 0
    ) {
        @Serializable
        data class Response(
            val taskDefinitions: kotlin.collections.List<TaskDefinitionDto>,
            val total: Int,
            val hasMore: Boolean
        )

        @Serializable
        data class TaskDefinitionDto(
            val id: String,
            val name: String,
            val description: String,
            val scheduledTimeRange: ScheduledTimeRangeDto,
            val scope: String,
            val ownerMemberId: String?,
            val schedule: ScheduleDto,
            val version: Int
        )
    }

    @Resource("/{taskDefinitionId}")
    class Get(
        val parent: TaskDefinitions = TaskDefinitions(),
        val taskDefinitionId: String
    ) {
        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val description: String,
            val scheduledTimeRange: ScheduledTimeRangeDto,
            val scope: String,
            val ownerMemberId: String?,
            val schedule: ScheduleDto,
            val version: Int
        )
    }

    @Resource("/create")
    class Create(
        val parent: TaskDefinitions = TaskDefinitions(),
    ) {
        @Serializable
        data class Request(
            val name: String,
            val description: String,
            val scheduledTimeRange: ScheduledTimeRangeDto,
            val scope: String,
            val ownerMemberId: String? = null,
            val schedule: ScheduleDto,
        )

        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val description: String,
            val scheduledTimeRange: ScheduledTimeRangeDto,
            val scope: String,
            val ownerMemberId: String?,
            val schedule: ScheduleDto,
            val version: Int,
        )
    }

    @Resource("/{taskDefinitionId}/update")
    class Update(
        val parent: TaskDefinitions = TaskDefinitions(),
        val taskDefinitionId: String,
    ) {
        @Serializable
        data class Request(
            val name: String? = null,
            val description: String? = null,
            val scheduledTimeRange: ScheduledTimeRangeDto? = null,
            val scope: String? = null,
            val ownerMemberId: String? = null,
            val schedule: ScheduleDto? = null,
        )

        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val description: String,
            val scheduledTimeRange: ScheduledTimeRangeDto,
            val scope: String,
            val ownerMemberId: String?,
            val schedule: ScheduleDto,
            val version: Int,
        )
    }

    @Resource("/{taskDefinitionId}/delete")
    class Delete(
        val parent: TaskDefinitions = TaskDefinitions(),
        val taskDefinitionId: String,
    ) {
        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val description: String,
            val scheduledTimeRange: ScheduledTimeRangeDto,
            val scope: String,
            val ownerMemberId: String?,
            val schedule: ScheduleDto,
            val version: Int,
        )
    }

    @Serializable
    data class ScheduledTimeRangeDto(
        val startTime: String,  // ISO-8601 形式
        val endTime: String,    // ISO-8601 形式
    )

    @Serializable
    sealed class ScheduleDto {
        @Serializable
        @SerialName("Recurring")
        data class Recurring(
            val pattern: PatternDto,
            val startDate: String,
            val endDate: String?,
        ) : ScheduleDto()

        @Serializable
        @SerialName("OneTime")
        data class OneTime(
            val deadline: String,
        ) : ScheduleDto()
    }

    @Serializable
    sealed class PatternDto {
        @Serializable
        @SerialName("Daily")
        data class Daily(
            val skipWeekends: Boolean,
        ) : PatternDto()

        @Serializable
        @SerialName("Weekly")
        data class Weekly(
            val dayOfWeek: String,
        ) : PatternDto()

        @Serializable
        @SerialName("Monthly")
        data class Monthly(
            val dayOfMonth: Int,
        ) : PatternDto()
    }
}

fun Route.taskDefinitions() {
    get<TaskDefinitions.List> { resource ->
        val output = instance<GetTaskDefinitionsUseCase>().execute(
            GetTaskDefinitionsUseCase.Input(
                limit = resource.limit,
                offset = resource.offset
            )
        )

        call.respond(
            HttpStatusCode.OK,
            TaskDefinitions.List.Response(
                taskDefinitions = output.taskDefinitions.map { taskDef ->
                    TaskDefinitions.List.TaskDefinitionDto(
                        id = taskDef.id.value.toString(),
                        name = taskDef.name.value,
                        description = taskDef.description.value,
                        scheduledTimeRange = taskDef.scheduledTimeRange.toDto(),
                        scope = taskDef.scope.value,
                        ownerMemberId = taskDef.ownerMemberId?.value?.toString(),
                        schedule = taskDef.schedule.toDto(),
                        version = taskDef.version
                    )
                },
                total = output.total,
                hasMore = output.hasMore
            )
        )
    }

    get<TaskDefinitions.Get> { resource ->
        val output = instance<GetTaskDefinitionUseCase>().execute(
            GetTaskDefinitionUseCase.Input(
                id = TaskDefinitionId(UUID.fromString(resource.taskDefinitionId))
            )
        )

        if (output == null) {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "TaskDefinition not found"))
            return@get
        }

        call.respond(
            HttpStatusCode.OK,
            TaskDefinitions.Get.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                description = output.description.value,
                scheduledTimeRange = output.scheduledTimeRange.toDto(),
                scope = output.scope.value,
                ownerMemberId = output.ownerMemberId?.value?.toString(),
                schedule = output.schedule.toDto(),
                version = output.version
            )
        )
    }

    post<TaskDefinitions.Create> {
        val request = call.receive<TaskDefinitions.Create.Request>()

        val output = instance<CreateTaskDefinitionUseCase>().execute(
            CreateTaskDefinitionUseCase.Input(
                name = TaskDefinitionName(request.name),
                description = TaskDefinitionDescription(request.description),
                scheduledTimeRange = request.scheduledTimeRange.toDomain(),
                scope = TaskScope.get(request.scope),
                ownerMemberId = request.ownerMemberId?.let { MemberId(UUID.fromString(it)) },
                schedule = request.schedule.toDomain(),
            )
        )

        call.respond(
            HttpStatusCode.Created,
            TaskDefinitions.Create.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                description = output.description.value,
                scheduledTimeRange = output.scheduledTimeRange.toDto(),
                scope = output.scope.value,
                ownerMemberId = output.ownerMemberId?.value?.toString(),
                schedule = output.schedule.toDto(),
                version = output.version,
            )
        )
    }

    post<TaskDefinitions.Update> { resource ->
        val request = call.receive<TaskDefinitions.Update.Request>()

        val output = instance<UpdateTaskDefinitionUseCase>().execute(
            UpdateTaskDefinitionUseCase.Input(
                id = TaskDefinitionId(UUID.fromString(resource.taskDefinitionId)),
                name = request.name?.let { TaskDefinitionName(it) },
                description = request.description?.let { TaskDefinitionDescription(it) },
                scheduledTimeRange = request.scheduledTimeRange?.toDomain(),
                scope = request.scope?.let { TaskScope.get(it) },
                ownerMemberId = request.ownerMemberId?.let { MemberId(UUID.fromString(it)) },
                schedule = request.schedule?.toDomain(),
            )
        )

        call.respond(
            HttpStatusCode.OK,
            TaskDefinitions.Update.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                description = output.description.value,
                scheduledTimeRange = output.scheduledTimeRange.toDto(),
                scope = output.scope.value,
                ownerMemberId = output.ownerMemberId?.value?.toString(),
                schedule = output.schedule.toDto(),
                version = output.version,
            )
        )
    }

    post<TaskDefinitions.Delete> { resource ->
        val output = instance<DeleteTaskDefinitionUseCase>().execute(
            DeleteTaskDefinitionUseCase.Input(
                id = TaskDefinitionId(UUID.fromString(resource.taskDefinitionId)),
            )
        )

        call.respond(
            HttpStatusCode.OK,
            TaskDefinitions.Delete.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                description = output.description.value,
                scheduledTimeRange = output.scheduledTimeRange.toDto(),
                scope = output.scope.value,
                ownerMemberId = output.ownerMemberId?.value?.toString(),
                schedule = output.schedule.toDto(),
                version = output.version,
            )
        )
    }
}

private fun TaskDefinitions.ScheduleDto.toDomain(): TaskSchedule {
    return when (this) {
        is TaskDefinitions.ScheduleDto.Recurring -> {
            TaskSchedule.Recurring(
                pattern = this.pattern.toDomain(),
                startDate = LocalDate.parse(this.startDate),
                endDate = this.endDate?.let { LocalDate.parse(it) },
            )
        }
        is TaskDefinitions.ScheduleDto.OneTime -> {
            TaskSchedule.OneTime(
                deadline = LocalDate.parse(this.deadline),
            )
        }
    }
}

private fun TaskDefinitions.PatternDto.toDomain(): RecurrencePattern {
    return when (this) {
        is TaskDefinitions.PatternDto.Daily -> {
            RecurrencePattern.Daily(skipWeekends = this.skipWeekends)
        }
        is TaskDefinitions.PatternDto.Weekly -> {
            RecurrencePattern.Weekly(dayOfWeek = java.time.DayOfWeek.valueOf(this.dayOfWeek))
        }
        is TaskDefinitions.PatternDto.Monthly -> {
            RecurrencePattern.Monthly(dayOfMonth = this.dayOfMonth)
        }
    }
}

private fun TaskSchedule.toDto(): TaskDefinitions.ScheduleDto {
    return when (this) {
        is TaskSchedule.Recurring -> {
            TaskDefinitions.ScheduleDto.Recurring(
                pattern = this.pattern.toDto(),
                startDate = this.startDate.toString(),
                endDate = this.endDate?.toString(),
            )
        }
        is TaskSchedule.OneTime -> {
            TaskDefinitions.ScheduleDto.OneTime(
                deadline = this.deadline.toString(),
            )
        }
    }
}

private fun RecurrencePattern.toDto(): TaskDefinitions.PatternDto {
    return when (this) {
        is RecurrencePattern.Daily -> {
            TaskDefinitions.PatternDto.Daily(skipWeekends = this.skipWeekends)
        }
        is RecurrencePattern.Weekly -> {
            TaskDefinitions.PatternDto.Weekly(dayOfWeek = this.dayOfWeek.name)
        }
        is RecurrencePattern.Monthly -> {
            TaskDefinitions.PatternDto.Monthly(dayOfMonth = this.dayOfMonth)
        }
    }
}

private fun TaskDefinitions.ScheduledTimeRangeDto.toDomain(): ScheduledTimeRange {
    return ScheduledTimeRange(
        startTime = Instant.parse(this.startTime),
        endTime = Instant.parse(this.endTime),
    )
}

private fun ScheduledTimeRange.toDto(): TaskDefinitions.ScheduledTimeRangeDto {
    return TaskDefinitions.ScheduledTimeRangeDto(
        startTime = this.startTime.toString(),
        endTime = this.endTime.toString(),
    )
}
