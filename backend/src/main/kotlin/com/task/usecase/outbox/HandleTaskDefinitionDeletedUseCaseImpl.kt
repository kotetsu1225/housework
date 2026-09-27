package com.task.usecase.outbox

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database
import com.task.infra.outbox.CompletedDomainEventRepository
import com.task.infra.outbox.DomainEventSerializer
import org.jooq.DSLContext
import org.slf4j.LoggerFactory
import java.time.Instant

/**
 * [HandleTaskDefinitionDeletedUseCase]の実装。
 *
 * 旧`ProcessOutboxEventsUseCaseImpl.processTaskDefinitionDeleted`のロジックをそのまま移した
 * (issue #61)。`TaskExecution.Cancelled`を直接構築している2箇所は、`TaskExecution`集約が
 * まだキャンセルを振る舞いとして持たないため(#10で対応予定、現状は#47によりtenantId引数が
 * 増えている)。tenantIdは親の`TaskExecution`から引き継ぐ(イベント自体はtenantIdを持たない、
 * #49のエンベロープ方式)。
 */
@Singleton
class HandleTaskDefinitionDeletedUseCaseImpl @Inject constructor(
    private val database: Database,
    private val completedDomainEventRepository: CompletedDomainEventRepository,
    private val taskExecutionRepository: TaskExecutionRepository,
) : HandleTaskDefinitionDeletedUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(input: HandleTaskDefinitionDeletedUseCase.Input): HandleTaskDefinitionDeletedUseCase.Output {
        return database.withTransaction(input.tenantId) { session ->
            executeInSession(input, session)
        }
    }

    override fun executeInSession(
        input: HandleTaskDefinitionDeletedUseCase.Input,
        session: DSLContext,
    ): HandleTaskDefinitionDeletedUseCase.Output {
        if (completedDomainEventRepository.exists(input.eventId, session)) {
            logger.info("Event already processed: ${input.eventId}")
            return HandleTaskDefinitionDeletedUseCase.Output(
                HandleTaskDefinitionDeletedUseCase.Outcome.ALREADY_PROCESSED
            )
        }

        val event = DomainEventSerializer.deserializeTaskDefinitionDeleted(input.payload)

        val executions = taskExecutionRepository.findByDefinitionId(event.taskDefinitionId, session)
            ?: emptyList()

        logger.info("Found ${executions.size} executions to cancel for definition: ${event.taskDefinitionId}")

        executions.forEach { execution ->
            when (execution) {
                is TaskExecution.NotStarted -> {
                    val now = Instant.now()
                    val cancelled = TaskExecution.Cancelled(
                        id = execution.id,
                        // tenantId は親の TaskExecution から引き継ぐ(自分では持たない)。
                        tenantId = execution.tenantId,
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
                        // tenantId は親の TaskExecution から引き継ぐ(自分では持たない)。
                        tenantId = execution.tenantId,
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

        completedDomainEventRepository.save(input.eventId, EVENT_TYPE, input.tenantId, session)
        logger.info("Successfully processed event: ${input.eventId}")

        return HandleTaskDefinitionDeletedUseCase.Output(HandleTaskDefinitionDeletedUseCase.Outcome.PROCESSED)
    }

    companion object {
        private const val EVENT_TYPE = "TaskDefinitionDeleted"
    }
}
