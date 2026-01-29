package com.task.usecase.taskDefinition.handler

import com.google.inject.Inject
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.event.DomainEventHandler
import com.task.domain.taskDefinition.event.TaskDefinitionDeleted
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import org.jooq.DSLContext

class TaskDefinitionDeletedHandler @Inject constructor(
    private val taskExecutionRepository: TaskExecutionRepository,
    private val domainEventDispatcher: DomainEventDispatcher
) : DomainEventHandler<TaskDefinitionDeleted> {

    override val eventType: Class<TaskDefinitionDeleted> = TaskDefinitionDeleted::class.java

    override fun handle(event: TaskDefinitionDeleted, session: DSLContext) {
        val executions = taskExecutionRepository.findByDefinitionId(event.taskDefinitionId, session)
            ?: emptyList()

        executions.forEach { execution ->
            val stateChange = when (execution) {
                is TaskExecution.NotStarted -> {
                    // TaskDefinitionが削除されたので、NotStartedタスクをキャンセル
                    // cancel()は内部でrequire(!isDeleted)をチェックするが、
                    // このケースではTaskDefinitionオブジェクトを渡さずにキャンセルする
                    val now = java.time.Instant.now()
                    val cancelled = TaskExecution.Cancelled(
                        id = execution.id,
                        taskDefinitionId = execution.taskDefinitionId,
                        scheduledDate = execution.scheduledDate,
                        assigneeMemberIds = execution.assigneeMemberIds,
                        taskSnapshot = null,
                        startedAt = null,
                        cancelledAt = now
                    )
                    val cancelEvent = com.task.domain.taskExecution.event.TaskExecutionCancelled(
                        taskExecutionId = execution.id,
                        taskName = event.name,
                        occurredAt = now
                    )
                    com.task.domain.taskExecution.StateChange(cancelled, cancelEvent)
                }

                is TaskExecution.InProgress -> {
                    // InProgressタスクも同様にキャンセル
                    val now = java.time.Instant.now()
                    val cancelled = TaskExecution.Cancelled(
                        id = execution.id,
                        taskDefinitionId = execution.taskDefinitionId,
                        scheduledDate = execution.scheduledDate,
                        assigneeMemberIds = execution.assigneeMemberIds,
                        taskSnapshot = execution.taskSnapshot,
                        startedAt = execution.startedAt,
                        cancelledAt = now
                    )
                    val cancelEvent = com.task.domain.taskExecution.event.TaskExecutionCancelled(
                        taskExecutionId = execution.id,
                        taskName = execution.taskSnapshot.frozenName,
                        occurredAt = now
                    )
                    com.task.domain.taskExecution.StateChange(cancelled, cancelEvent)
                }

                is TaskExecution.Completed,
                is TaskExecution.Cancelled -> null
            }

            if (stateChange != null) {
                taskExecutionRepository.update(stateChange.newState, session)
                domainEventDispatcher.dispatchAll(listOf(stateChange.event), session)
            }
        }
    }
}
