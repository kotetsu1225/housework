package com.task.usecase.taskExecution.get

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.domain.taskExecution.TaskSnapshot
import com.task.infra.database.Database

@Singleton
class GetTaskExecutionsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository
) : GetTaskExecutionsUseCase {

    override fun execute(input: GetTaskExecutionsUseCase.Input): GetTaskExecutionsUseCase.Output {
        return database.withTransaction { session ->
            val (items, totalCount) = if (input.filter.isEmpty()) {
                val items = taskExecutionRepository.findAll(session, input.limit, input.offset)
                val count = taskExecutionRepository.count(session)
                items to count
            } else {
                val items = taskExecutionRepository.findAllWithFilter(
                    session,
                    input.limit,
                    input.offset,
                    input.filter
                )
                val count = taskExecutionRepository.countWithFilter(session, input.filter)
                items to count
            }

            GetTaskExecutionsUseCase.Output(
                items = items.map { toOutput(it) },
                totalCount = totalCount
            )
        }
    }

    private fun toOutput(taskExecution: TaskExecution): GetTaskExecutionsUseCase.TaskExecutionOutput {
        return when (taskExecution) {
            is TaskExecution.NotStarted -> GetTaskExecutionsUseCase.TaskExecutionOutput(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "NOT_STARTED",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = null,
                completedAt = null,
                snapshot = null
            )

            is TaskExecution.InProgress -> GetTaskExecutionsUseCase.TaskExecutionOutput(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "IN_PROGRESS",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = taskExecution.startedAt,
                completedAt = null,
                snapshot = toSnapshotOutput(taskExecution.taskSnapshot)
            )

            is TaskExecution.Completed -> GetTaskExecutionsUseCase.TaskExecutionOutput(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "COMPLETED",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = taskExecution.startedAt,
                completedAt = taskExecution.completedAt,
                snapshot = toSnapshotOutput(taskExecution.taskSnapshot)
            )

            is TaskExecution.Cancelled -> GetTaskExecutionsUseCase.TaskExecutionOutput(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "CANCELLED",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = taskExecution.startedAt,
                completedAt = null,
                snapshot = taskExecution.taskSnapshot?.let { toSnapshotOutput(it) }
            )
        }
    }

    private fun toSnapshotOutput(snapshot: TaskSnapshot): GetTaskExecutionsUseCase.SnapshotOutput {
        return GetTaskExecutionsUseCase.SnapshotOutput(
            name = snapshot.frozenName.value,
            description = snapshot.frozenDescription.value,
            scheduledStartTime = snapshot.frozenScheduledTimeRange.startTime,
            scheduledEndTime = snapshot.frozenScheduledTimeRange.endTime,
            definitionVersion = snapshot.definitionVersion,
            capturedAt = snapshot.capturedAt
        )
    }
}
