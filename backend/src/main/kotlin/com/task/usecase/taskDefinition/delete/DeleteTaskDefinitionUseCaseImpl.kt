package com.task.usecase.taskDefinition.delete

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.task.service.TaskDefinitionAuthService
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.event.TaskDefinitionDeleted
import com.task.infra.database.Database
import com.task.infra.outbox.DomainEventSerializer
import com.task.infra.outbox.OutboxRecord
import com.task.infra.outbox.OutboxRepository

@Singleton
class DeleteTaskDefinitionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val authorizationService: TaskDefinitionAuthService,
    private val outboxRepository: OutboxRepository,
) : DeleteTaskDefinitionUseCase {

    override fun execute(input: DeleteTaskDefinitionUseCase.Input): DeleteTaskDefinitionUseCase.Output {
        return database.withTransaction { session ->
            val targetTaskDefinition = taskDefinitionRepository.findById(input.id, session)
                ?: throw IllegalArgumentException("TaskDefinition with id ${input.id.value} が見つかりませんでした。")

            authorizationService.requireDeletePermission(targetTaskDefinition, input.requesterId)

            val deletedTaskDefinition = targetTaskDefinition.delete()

            taskDefinitionRepository.update(deletedTaskDefinition, session)

            deletedTaskDefinition.domainEvents.forEach { event ->
                if (event is TaskDefinitionDeleted) {
                    val outboxRecord = OutboxRecord.create(
                        eventType = DomainEventSerializer.getEventType(event),
                        aggregateType = "TaskDefinition",
                        aggregateId = event.taskDefinitionId.value,
                        payload = DomainEventSerializer.serialize(event)
                    )
                    outboxRepository.save(outboxRecord, session)
                }
            }
            deletedTaskDefinition.clearDomainEvents()

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
