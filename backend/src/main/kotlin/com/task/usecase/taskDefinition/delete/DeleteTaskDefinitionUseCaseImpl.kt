package com.task.usecase.taskDefinition.delete

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class DeleteTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : DeleteTaskDefinitionUseCase {

    override fun execute(input: DeleteTaskDefinitionUseCase.Input): DeleteTaskDefinitionUseCase.Output {
        TODO("Not yet implemented")
    }
}
