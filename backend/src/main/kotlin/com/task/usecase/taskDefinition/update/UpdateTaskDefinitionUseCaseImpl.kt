package com.task.usecase.taskDefinition.update

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class UpdateTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : UpdateTaskDefinitionUseCase {

    override fun execute(input: UpdateTaskDefinitionUseCase.Input): UpdateTaskDefinitionUseCase.Output {
        TODO("Not yet implemented")
    }
}
