package com.task.usecase.taskDefinition.delete

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.service.TaskDefinitionAuthorizationService
import com.task.infra.database.Database

@Singleton
class DeleteTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val authorizationService: TaskDefinitionAuthorizationService,
) : DeleteTaskDefinitionUseCase {

    override fun execute(input: DeleteTaskDefinitionUseCase.Input): DeleteTaskDefinitionUseCase.Output {
        return database.withTransaction { session ->
            val targetTaskDefinition = taskDefinitionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskDefinition with id ${input.id.value} が見つかりませんでした。")

            authorizationService.requireDeletePermission(targetTaskDefinition, input.requesterId)

            val deletedTaskDefinition = targetTaskDefinition.delete()

            taskDefinitionRepository.update(deletedTaskDefinition, session)

            DeleteTaskDefinitionUseCase.Output(
                id = deletedTaskDefinition.id,
                name = deletedTaskDefinition.name,
                description = deletedTaskDefinition.description,
                scheduledTimeRange = deletedTaskDefinition.scheduledTimeRange,
                scope = deletedTaskDefinition.scope,
                ownerMemberId = deletedTaskDefinition.ownerMemberId,
                schedule = deletedTaskDefinition.schedule,
                version = deletedTaskDefinition.version,
            )
        }
    }
}
