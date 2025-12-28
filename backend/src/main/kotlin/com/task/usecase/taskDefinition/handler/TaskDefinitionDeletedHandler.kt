package com.task.usecase.taskDefinition.handler

import com.google.inject.Inject
import com.task.domain.event.DomainEventHandler
import com.task.domain.taskDefinition.event.TaskDefinitionDeleted
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import org.jooq.DSLContext

class TaskDefinitionDeletedHandler @Inject constructor(
    private val taskExecutionRepository: TaskExecutionRepository
) : DomainEventHandler<TaskDefinitionDeleted> {

    override val eventType: Class<TaskDefinitionDeleted> = TaskDefinitionDeleted::class.java

    override fun handle(event: TaskDefinitionDeleted, session: DSLContext) {
        val executions = taskExecutionRepository.findByDefinitionId(event.taskDefinitionId, session)
            ?: emptyList()

        executions.forEach { execution ->
            val cancelled = when (execution) {
                is TaskExecution.NotStarted -> execution.cancelByDefinitionDeletion()
                is TaskExecution.InProgress -> execution.cancelByDefinitionDeletion()

                is TaskExecution.Completed,
                is TaskExecution.Cancelled -> null
            }

            if (cancelled != null) {
                taskExecutionRepository.update(cancelled, session)
            }
        }
    }
}
