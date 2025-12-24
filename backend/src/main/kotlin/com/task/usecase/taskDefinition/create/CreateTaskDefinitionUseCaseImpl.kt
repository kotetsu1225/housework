package com.task.usecase.taskDefinition.create

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class CreateTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : CreateTaskDefinitionUseCase {

    override fun execute(input: CreateTaskDefinitionUseCase.Input): CreateTaskDefinitionUseCase.Output {
        return database.withTransaction { session ->
            val newTaskDefinition = TaskDefinition.create(
                name = input.name,
                description = input.description,
                estimatedMinutes = input.estimatedMinutes,
                scope = input.scope,
                ownerMemberId = input.ownerMemberId,
                schedule = input.schedule,
            )

            val taskDefinition = taskDefinitionRepository.create(newTaskDefinition, session)

            CreateTaskDefinitionUseCase.Output(
                id = taskDefinition.id,
                name = taskDefinition.name,
                description = taskDefinition.description,
                estimatedMinutes = taskDefinition.estimatedMinutes,
                scope = taskDefinition.scope,
                ownerMemberId = taskDefinition.ownerMemberId,
                schedule = taskDefinition.schedule,
                version = taskDefinition.version,
            )
        }
    }
}
