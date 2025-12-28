package com.task.usecase.taskExecution.start

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database

@Singleton
class StartTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : StartTaskExecutionUseCase {

    override fun execute(input: StartTaskExecutionUseCase.Input): StartTaskExecutionUseCase.Output {
        return database.withTransaction { session ->
            val taskExecution = taskExecutionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("タスク実行が見つかりません: ${input.id}")
            val taskDefinition = taskDefinitionRepository.findById(taskExecution.taskDefinitionId, session)
                ?: throw IllegalArgumentException("タスク定義が見つかりません: ${taskExecution.taskDefinitionId}")
            val startedExecution = when (taskExecution) {
                is TaskExecution.NotStarted -> {
                    taskExecution.start(
                        assigneeMemberId = input.assigneeMemberId,
                        taskDefinition = taskDefinition
                    )
                }
                is TaskExecution.InProgress -> {
                    throw IllegalStateException("タスクは既に開始されています")
                }
                is TaskExecution.Completed -> {
                    throw IllegalStateException("タスクは既に完了しています")
                }
                is TaskExecution.Cancelled -> {
                    throw IllegalStateException("タスクはキャンセル済みです")
                }
            }

            taskExecutionRepository.update(startedExecution, session)

            StartTaskExecutionUseCase.Output(
                id = startedExecution.id,
                taskDefinitionId = startedExecution.taskDefinitionId,
                assigneeMemberId = startedExecution.assigneeMemberId,
                taskSnapshot = startedExecution.taskSnapshot,
                scheduledDate = startedExecution.scheduledDate,
                startedAt = startedExecution.startedAt
            )
        }
    }
}
