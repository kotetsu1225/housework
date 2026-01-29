package com.task.usecase.taskExecution.assign

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database

@Singleton
class UpdateAssignTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository
) : UpdateAssignTaskExecutionUseCase {
    override fun execute(input: UpdateAssignTaskExecutionUseCase.Input): UpdateAssignTaskExecutionUseCase.Output {
        return database.withTransaction { session ->
            val existingExecution = taskExecutionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskExecution with id ${input.id} does not exist")

            val taskExecution = taskExecutionRepository.updateAssigneeMember(existingExecution, input.newAssigneeMemberIds ,session)

            toOutput(taskExecution)
        }
    }

    private fun toOutput(taskExecution: TaskExecution): UpdateAssignTaskExecutionUseCase.Output {
        return when (taskExecution) {
            is TaskExecution.NotStarted -> UpdateAssignTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "NOT_STARTED",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = null,
                completedAt = null,
                completedByMemberId = null,
                snapshot = null
            )
            is TaskExecution.InProgress -> UpdateAssignTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "IN_PROGRESS",
                assigneeMemberIds = taskExecution.assigneeMemberIds,
                startedAt = taskExecution.startedAt,
                completedAt = null,
                completedByMemberId = null,
                snapshot = UpdateAssignTaskExecutionUseCase.SnapshotOutput(
                    name = taskExecution.taskSnapshot.frozenName.value,
                    description = taskExecution.taskSnapshot.frozenDescription.value,
                    scheduledStartTime = taskExecution.taskSnapshot.frozenScheduledTimeRange.startTime,
                    scheduledEndTime = taskExecution.taskSnapshot.frozenScheduledTimeRange.endTime,
                    definitionVersion = taskExecution.taskSnapshot.definitionVersion,
                    capturedAt = taskExecution.taskSnapshot.capturedAt,
                    point = taskExecution.taskSnapshot.frozenPoint
                )
            )
            is TaskExecution.Completed,
            is TaskExecution.Cancelled -> {
                throw IllegalStateException("この状態のTaskExecutionはassign操作の結果として返されません")
            }
        }
    }
}