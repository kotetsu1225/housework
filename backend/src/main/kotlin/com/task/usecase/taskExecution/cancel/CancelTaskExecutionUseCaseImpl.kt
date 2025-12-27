package com.task.usecase.taskExecution.cancel

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.domain.taskExecution.TaskSnapshot
import com.task.infra.database.Database
import org.jooq.DSLContext
import java.time.Instant

@Singleton
class CancelTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository,
    private val taskDefinitionRepository: TaskDefinitionRepository,
) : CancelTaskExecutionUseCase {
    override fun execute(input: CancelTaskExecutionUseCase.Input): CancelTaskExecutionUseCase.Output {
        return database.withTransaction { session: DSLContext ->
            val taskExecution = taskExecutionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskExecution with id ${input.id} not found")
            val taskDefinition = taskDefinitionRepository.findById(taskExecution.taskDefinitionId, session)
                ?: throw IllegalArgumentException("TaskDefinition id not found: ${taskExecution.taskDefinitionId}")

            val cancelledExecution = when(taskExecution){
                is TaskExecution.NotStarted -> {
                    taskExecution. cancel(
                        taskDefinition.isDeleted
                    )
                }
                is TaskExecution.InProgress -> {
                    taskExecution.cancel(
                        taskDefinition.isDeleted
                    )
                }
                is TaskExecution.Completed -> {
                    throw IllegalStateException("タスクは既に完了しています")
                }
                is TaskExecution.Cancelled -> {
                    throw IllegalStateException("タスクはキャンセル済みです")
                }
            }

            taskExecutionRepository.update(cancelledExecution,session)

            CancelTaskExecutionUseCase.Output(
                id = cancelledExecution.id,
                taskDefinitionId = cancelledExecution.taskDefinitionId,
                scheduleDate = cancelledExecution.scheduledDate,
                taskSnapshot = cancelledExecution.taskSnapshot,
            )


        }
    }
}
