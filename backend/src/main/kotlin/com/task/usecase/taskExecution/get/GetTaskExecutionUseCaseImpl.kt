package com.task.usecase.taskExecution.get

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.domain.taskExecution.TaskSnapshot
import com.task.infra.database.Database

@Singleton
class GetTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository
) : GetTaskExecutionUseCase {

    override fun execute(input: GetTaskExecutionUseCase.Input): GetTaskExecutionUseCase.Output? {
        val taskExecution = database.withTransaction { session ->
            taskExecutionRepository.findById(input.id, session)
        } ?: return null

        return toOutput(taskExecution)
    }

    private fun toOutput(taskExecution: TaskExecution): GetTaskExecutionUseCase.Output {
        return when (taskExecution) {
            is TaskExecution.NotStarted -> GetTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "NOT_STARTED",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = null,
                completedAt = null,
                snapshot = null
            )

            is TaskExecution.InProgress -> GetTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "IN_PROGRESS",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = taskExecution.startedAt,
                completedAt = null,
                snapshot = toSnapshotOutput(taskExecution.taskSnapshot)
            )

            is TaskExecution.Completed -> GetTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "COMPLETED",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = taskExecution.startedAt,
                completedAt = taskExecution.completedAt,
                snapshot = toSnapshotOutput(taskExecution.taskSnapshot)
            )

            is TaskExecution.Cancelled -> GetTaskExecutionUseCase.Output(
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

    private fun toSnapshotOutput(snapshot: TaskSnapshot): GetTaskExecutionUseCase.SnapshotOutput {
        return GetTaskExecutionUseCase.SnapshotOutput(
            name = snapshot.frozenName.value,
            description = snapshot.frozenDescription.value,
            scheduledStartTime = snapshot.frozenScheduledTimeRange.startTime,
            scheduledEndTime = snapshot.frozenScheduledTimeRange.endTime,
            definitionVersion = snapshot.definitionVersion,
            capturedAt = snapshot.capturedAt
        )
    }
}
