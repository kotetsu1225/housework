package com.task.usecase.taskExecution.complete

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database


@Singleton
class CompleteTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository,
    private val taskDefinitionRepository: TaskDefinitionRepository
):CompleteTaskExecutionUseCase {

    override fun execute(input: CompleteTaskExecutionUseCase.Input): CompleteTaskExecutionUseCase.Output {
        return database.withTransaction { session ->
            val taskExecution = taskExecutionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("タスク実行が見つかりません: ${input.id}")
            val taskDefinition = taskDefinitionRepository.findById(taskExecution.taskDefinitionId, session)
                ?: throw IllegalArgumentException("タスク定義が見つかりません: ${taskExecution.taskDefinitionId}")

            val completedExecution = when(taskExecution){
                is TaskExecution.InProgress -> {
                    taskExecution.complete(
                        input.completedMemberId,
                        taskDefinition.isDeleted
                    )
                }
                is TaskExecution.NotStarted -> {
                    throw IllegalStateException("タスクが開始されていません")
                }
                is TaskExecution.Completed -> {
                    throw IllegalStateException("タスクは既に完了しています")
                }
                is TaskExecution.Cancelled -> {
                    throw IllegalStateException("タスクはキャンセル済みです")
                }
            }

            taskExecutionRepository.update(completedExecution, session)

            CompleteTaskExecutionUseCase.Output(
                id = completedExecution.id,
                taskDefinitionId = taskDefinition.id,
                scheduledDate = completedExecution.scheduledDate,
                taskSnapshot = completedExecution.taskSnapshot,
                completedAt = completedExecution.completedAt,
                completedMemberId = completedExecution.completedByMemberId
            )
        }
    }
}
