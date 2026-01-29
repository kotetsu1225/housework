package com.task.usecase.taskDefinition.get

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class GetTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : GetTaskDefinitionUseCase {

    override fun execute(input: GetTaskDefinitionUseCase.Input): GetTaskDefinitionUseCase.Output? {
        val taskDefinition = database.withTransaction { session ->
            taskDefinitionRepository.findById(input.id, session)
        }

        return taskDefinition?.let {
            GetTaskDefinitionUseCase.Output(
                id = it.id,
                name = it.name,
                description = it.description,
                scheduledTimeRange = it.scheduledTimeRange,
                scope = it.scope,
                ownerMemberId = it.ownerMemberId,
                schedule = it.schedule,
                version = it.version
            )
        }
    }
}
