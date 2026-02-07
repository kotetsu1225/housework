package com.task.usecase.outbox

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database
import com.task.infra.outbox.CompletedDomainEventRepository
import com.task.infra.outbox.DomainEventSerializer
import com.task.infra.outbox.OutboxRecord
import com.task.infra.outbox.OutboxRepository
import org.slf4j.LoggerFactory
import java.time.Instant
import java.util.UUID

@Singleton
class ProcessOutboxEventsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val outboxRepository: OutboxRepository,
    private val completedDomainEventRepository: CompletedDomainEventRepository,
    private val taskExecutionRepository: TaskExecutionRepository
) : ProcessOutboxEventsUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(input: ProcessOutboxEventsUseCase.Input): ProcessOutboxEventsUseCase.Output {
        var processedCount = 0
        var failedCount = 0

        val pendingRecords = database.withSession { session ->
            outboxRepository.findPending(session, input.batchSize)
        }

        logger.info("Found ${pendingRecords.size} pending outbox events")

        pendingRecords.forEach { record ->
            try {
                processEvent(record)
                processedCount++
            } catch (e: Exception) {
                logger.error("Failed to process outbox event: ${record.id}", e)
                markAsFailed(record, e.message ?: "Unknown error")
                failedCount++
            }
        }

        return ProcessOutboxEventsUseCase.Output(
            processedCount = processedCount,
            failedCount = failedCount
        )
    }

    private fun processEvent(record: OutboxRecord) {
        when (record.eventType) {
            "TaskDefinitionDeleted" -> processTaskDefinitionDeleted(record)
            else -> {
                logger.warn("Unknown event type: ${record.eventType}")
                markAsProcessed(record)
            }
        }
    }

    private fun processTaskDefinitionDeleted(record: OutboxRecord) {
        val event = DomainEventSerializer.deserializeTaskDefinitionDeleted(record.payload)
        val eventId = DomainEventSerializer.extractEventId(record.payload)

        database.withTransaction { session ->
            if (completedDomainEventRepository.exists(eventId, session)) {
                logger.info("Event already processed: $eventId")
                outboxRepository.update(record.markAsProcessed(), session)
                return@withTransaction
            }

            val executions = taskExecutionRepository.findByDefinitionId(event.taskDefinitionId, session)
                ?: emptyList()

            logger.info("Found ${executions.size} executions to cancel for definition: ${event.taskDefinitionId}")

            executions.forEach { execution ->
                when (execution) {
                    is TaskExecution.NotStarted -> {
                        val now = Instant.now()
                        val cancelled = TaskExecution.Cancelled(
                            id = execution.id,
                            taskDefinitionId = execution.taskDefinitionId,
                            scheduledDate = execution.scheduledDate,
                            assigneeMemberIds = execution.assigneeMemberIds,
                            taskSnapshot = null,
                            startedAt = null,
                            cancelledAt = now
                        )
                        taskExecutionRepository.update(cancelled, session)
                        logger.info("Cancelled NotStarted execution: ${execution.id}")
                    }

                    is TaskExecution.InProgress -> {
                        val now = Instant.now()
                        val cancelled = TaskExecution.Cancelled(
                            id = execution.id,
                            taskDefinitionId = execution.taskDefinitionId,
                            scheduledDate = execution.scheduledDate,
                            assigneeMemberIds = execution.assigneeMemberIds,
                            taskSnapshot = execution.taskSnapshot,
                            startedAt = execution.startedAt,
                            cancelledAt = now
                        )
                        taskExecutionRepository.update(cancelled, session)
                        logger.info("Cancelled InProgress execution: ${execution.id}")
                    }

                    is TaskExecution.Completed,
                    is TaskExecution.Cancelled -> {
                        logger.debug("Skipping ${execution::class.simpleName} execution: ${execution.id}")
                    }
                }
            }

            completedDomainEventRepository.save(eventId, record.eventType, session)
            outboxRepository.update(record.markAsProcessed(), session)

            logger.info("Successfully processed event: $eventId")
        }
    }

    private fun markAsProcessed(record: OutboxRecord) {
        database.withTransaction { session ->
            outboxRepository.update(record.markAsProcessed(), session)
        }
    }

    private fun markAsFailed(record: OutboxRecord, errorMessage: String) {
        database.withTransaction { session ->
            outboxRepository.update(record.incrementRetry(errorMessage), session)
        }
    }
}
