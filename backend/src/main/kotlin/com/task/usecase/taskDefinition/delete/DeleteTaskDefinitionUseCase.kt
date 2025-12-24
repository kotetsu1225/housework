package com.task.usecase.taskDefinition.delete

import com.google.inject.ImplementedBy
import com.task.domain.taskDefinition.TaskDefinitionId

@ImplementedBy(DeleteTaskDefinitionUseCaseImpl::class)
interface DeleteTaskDefinitionUseCase {
    data class Input(
        val id: TaskDefinitionId,
    )

    data class Output(
        val id: TaskDefinitionId,
    )

    fun execute(input: Input): Output
}
