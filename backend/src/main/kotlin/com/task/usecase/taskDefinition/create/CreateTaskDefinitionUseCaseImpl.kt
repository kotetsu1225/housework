package com.task.usecase.taskDefinition.create

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database

@Singleton
class CreateTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val domainEventDispatcher: DomainEventDispatcher
) : CreateTaskDefinitionUseCase {

    override fun execute(input: CreateTaskDefinitionUseCase.Input): CreateTaskDefinitionUseCase.Output {
        return database.withTransaction { session ->
            val newTaskDefinition = TaskDefinition.create(
                name = input.name,
                description = input.description,
                scheduledTimeRange = input.scheduledTimeRange,
                scope = input.scope,
                ownerMemberId = input.ownerMemberId,
                schedule = input.schedule,
                point = input.point
            )

            val taskDefinition = taskDefinitionRepository.create(newTaskDefinition, session)

            // ドメインイベントの蓄積を呼び出す
            domainEventDispatcher.dispatchAll(taskDefinition.domainEvents, session)
            taskDefinition.clearDomainEvents()

            CreateTaskDefinitionUseCase.Output(
                id = taskDefinition.id,
                name = taskDefinition.name,
                description = taskDefinition.description,
                scheduledTimeRange = taskDefinition.scheduledTimeRange,
                scope = taskDefinition.scope,
                ownerMemberId = taskDefinition.ownerMemberId,
                schedule = taskDefinition.schedule,
                version = taskDefinition.version,
                point = taskDefinition.point
            )
        }
    }
}
