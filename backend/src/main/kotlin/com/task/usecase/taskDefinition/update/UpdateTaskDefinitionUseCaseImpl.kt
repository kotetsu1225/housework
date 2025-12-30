package com.task.usecase.taskDefinition.update

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.service.TaskDefinitionAuthorizationService
import com.task.infra.database.Database

@Singleton
class UpdateTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val authorizationService: TaskDefinitionAuthorizationService,
) : UpdateTaskDefinitionUseCase {
    override fun execute(input: UpdateTaskDefinitionUseCase.Input): UpdateTaskDefinitionUseCase.Output {
        return database.withTransaction { session ->
            val targetTaskDefinition = taskDefinitionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskDefinition with id ${input.id.value} が見つかりませんでした。")

            authorizationService.requireEditPermission(targetTaskDefinition, input.requesterId)

            val updatedTaskDefinition = targetTaskDefinition.update(
                id = input.id,
                name = input.name,
                description = input.description,
                scheduledTimeRange = input.scheduledTimeRange,
                scope = input.scope,
                ownerMemberId = input.ownerMemberId,
                schedule = input.schedule,
            )

            taskDefinitionRepository.update(updatedTaskDefinition, session)

            UpdateTaskDefinitionUseCase.Output(
                id = updatedTaskDefinition.id,
                name = updatedTaskDefinition.name,
                description = updatedTaskDefinition.description,
                scheduledTimeRange = updatedTaskDefinition.scheduledTimeRange,
                scope = updatedTaskDefinition.scope,
                ownerMemberId = updatedTaskDefinition.ownerMemberId,
                schedule = updatedTaskDefinition.schedule,
                version = updatedTaskDefinition.version,
            )
        }
    }
}
