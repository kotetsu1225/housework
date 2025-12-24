package com.task.usecase.taskDefinition.create

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class CreateTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : CreateTaskDefinitionUseCase {

    override fun execute(input: CreateTaskDefinitionUseCase.Input): CreateTaskDefinitionUseCase.Output {
        
    }
}
