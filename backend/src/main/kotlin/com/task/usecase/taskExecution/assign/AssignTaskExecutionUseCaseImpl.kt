package com.task.usecase.taskExecution.assign

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database

@Singleton
class AssignTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository
) : AssignTaskExecutionUseCase {
    override fun execute(input: AssignTaskExecutionUseCase.Input): AssignTaskExecutionUseCase.Output {
        return database.withTransaction { session ->
            val existingExecution = taskExecutionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskExecution with id ${input.id} does not exist")
            val assigneeChangedExecution = when(existingExecution) {
                is TaskExecution.NotStarted -> {
                    existingExecution.assign(
                        newAssigneeMemberId = input.newAssigneeMemberId
                    )
                }
                is TaskExecution.InProgress -> {
                    existingExecution.assign(
                        newAssigneeMemberId = input.newAssigneeMemberId
                    )
                }
                is TaskExecution.Completed -> {
                    throw IllegalStateException("タスクは既に完了しています")
                }
                is TaskExecution.Cancelled -> {
                    throw IllegalStateException("タスクはキャンセル済みです")
                }
            }

            taskExecutionRepository.update(assigneeChangedExecution, session)

            toOutput(assigneeChangedExecution)
        }
    }

    private fun toOutput(taskExecution: TaskExecution): AssignTaskExecutionUseCase.Output {
        return when (taskExecution) {
            is TaskExecution.NotStarted -> AssignTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "NOT_STARTED",
                assigneeMemberId = taskExecution.assigneeMemberId,
                startedAt = null,
                completedAt = null,
                completedByMemberId = null,
                snapshot = null
            )
            is TaskExecution.InProgress -> AssignTaskExecutionUseCase.Output(
                id = taskExecution.id,
                taskDefinitionId = taskExecution.taskDefinitionId,
                scheduledDate = taskExecution.scheduledDate,
                status = "IN_PROGRESS",
                assigneeMemberId = taskExecution.assigneeMemberId,
                startedAt = taskExecution.startedAt,
                completedAt = null,
                completedByMemberId = null,
                snapshot = AssignTaskExecutionUseCase.SnapshotOutput(
                    name = taskExecution.taskSnapshot.frozenName.value,
                    description = taskExecution.taskSnapshot.frozenDescription.value,
                    scheduledStartTime = taskExecution.taskSnapshot.frozenScheduledTimeRange.startTime,
                    scheduledEndTime = taskExecution.taskSnapshot.frozenScheduledTimeRange.endTime,
                    definitionVersion = taskExecution.taskSnapshot.definitionVersion,
                    capturedAt = taskExecution.taskSnapshot.capturedAt
                )
            )
            is TaskExecution.Completed,
            is TaskExecution.Cancelled -> {
                throw IllegalStateException("この状態のTaskExecutionはassign操作の結果として返されません")
            }
        }
    }
}