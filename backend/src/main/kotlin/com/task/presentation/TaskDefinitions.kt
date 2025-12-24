package com.task.presentation

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*
import com.task.usecase.taskDefinition.create.CreateTaskDefinitionUseCase
import com.task.usecase.taskDefinition.delete.DeleteTaskDefinitionUseCase
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.util.UUID

@Resource("api/task-definitions")
class TaskDefinitions {
    @Resource("/create")
    class Create(
        val parent: TaskDefinitions = TaskDefinitions(),
    ) {
        @Serializable
        data class Request(
            val name: String,
            val description: String,
            val estimatedMinutes: Int,
            val scope: String,
            val ownerMemberId: String? = null,
            val schedule: ScheduleDto,
        )

        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val description: String,
            val estimatedMinutes: Int,
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
            val estimatedMinutes: Int? = null,
            val scope: String? = null,
            val ownerMemberId: String? = null,
            val schedule: ScheduleDto? = null,
        )

        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val description: String,
            val estimatedMinutes: Int,
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
            val estimatedMinutes: Int,
            val scope: String,
            val ownerMemberId: String?,
            val schedule: ScheduleDto,
            val version: Int,
        )
    }

    @Serializable
    sealed class ScheduleDto {
        @Serializable
        data class Recurring(
            val pattern: PatternDto,
            val startDate: String,
            val endDate: String?,
        ) : ScheduleDto()

        @Serializable
        data class OneTime(
            val deadline: String,
        ) : ScheduleDto()
    }

    @Serializable
    sealed class PatternDto {
        @Serializable
        data class Daily(
            val skipWeekends: Boolean,
        ) : PatternDto()

        @Serializable
        data class Weekly(
            val dayOfWeek: String,
        ) : PatternDto()

        @Serializable
        data class Monthly(
            val dayOfMonth: Int,
        ) : PatternDto()
    }
}

fun Route.taskDefinitions() {
    post<TaskDefinitions.Create> {
        val request = call.receive<TaskDefinitions.Create.Request>()

        val output = instance<CreateTaskDefinitionUseCase>().execute(
            CreateTaskDefinitionUseCase.Input(
                name = TaskDefinitionName(request.name),
                description = TaskDefinitionDescription(request.description),
                estimatedMinutes = request.estimatedMinutes,
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
                estimatedMinutes = output.estimatedMinutes,
                scope = output.scope.value,
                ownerMemberId = output.ownerMemberId?.value?.toString(),
                schedule = output.schedule.toDto(),
                version = output.version,
            )
        )
    }

    post<TaskDefinitions.Update> {
        val request = call.receive<TaskDefinitions.Update.Request>()

        val output = instance<UpdateTaskDefinitionUseCase>().execute(
            UpdateTaskDefinitionUseCase.Input(
                id = TaskDefinitionId(UUID.fromString(it.taskDefinitionId)),
                name = request.name?.let { TaskDefinitionName(it) },
                description = request.description?.let { TaskDefinitionDescription(it) },
                estimatedMinutes = request.estimatedMinutes,
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
                estimatedMinutes = output.estimatedMinutes,
                scope = output.scope.value,
                ownerMemberId = output.ownerMemberId?.value?.toString(),
                schedule = output.schedule.toDto(),
                version = output.version,
            )
        )
    }

    post<TaskDefinitions.Delete> {
        val output = instance<DeleteTaskDefinitionUseCase>().execute(
            DeleteTaskDefinitionUseCase.Input(
                id = TaskDefinitionId(UUID.fromString(it.taskDefinitionId)),
            )
        )

        call.respond(
            HttpStatusCode.OK,
            TaskDefinitions.Delete.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                description = output.description.value,
                estimatedMinutes = output.estimatedMinutes,
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
