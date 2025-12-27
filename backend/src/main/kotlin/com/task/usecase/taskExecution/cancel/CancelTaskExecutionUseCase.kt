package com.task.usecase.taskExecution.cancel

import com.google.inject.ImplementedBy
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.taskExecution.TaskSnapshot
import java.time.Instant

@ImplementedBy(CancelTaskExecutionUseCaseImpl::class)
interface CancelTaskExecutionUseCase {
    data class Input(
        val id: TaskExecutionId
    )

    data class Output(
        val id: TaskExecutionId,
        val taskDefinitionId: TaskDefinitionId,
        val scheduleDate: Instant,
        val taskSnapshot: TaskSnapshot?,
    )

    fun execute(input: Input): Output
}
