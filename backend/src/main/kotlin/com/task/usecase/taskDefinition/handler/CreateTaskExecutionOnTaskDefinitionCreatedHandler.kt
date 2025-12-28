package com.task.usecase.taskDefinition.handler

import com.google.inject.Inject
import com.task.domain.event.DomainEventHandler
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskDefinition.event.TaskDefinitionCreated
import com.task.domain.taskExecution.TaskExecution.*
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.taskExecution.TaskExecutionRepository
import org.jooq.DSLContext
import java.time.ZoneId

class CreateTaskExecutionOnTaskDefinitionCreatedHandler @Inject constructor(
    private val taskExecutionRepository: TaskExecutionRepository,
) : DomainEventHandler<TaskDefinitionCreated> {
    override val eventType: Class<TaskDefinitionCreated> = TaskDefinitionCreated::class.java

    override fun handle(event: TaskDefinitionCreated, session: DSLContext) {
        val schedule = event.schedule
        if (schedule !is TaskSchedule.OneTime) {
            return
        }

        val assigneeMemberId = if (event.scope == TaskScope.PERSONAL) {
            event.ownerMemberId
        }else{
            null
        }

        val scheduledDate = schedule.deadline
            .atStartOfDay(ZoneId.of("Asia/Tokyo"))
            .toInstant()

        val taskExecution = NotStarted(
            id = TaskExecutionId.generate(),
            taskDefinitionId = event.taskDefinitionId,
            scheduledDate = scheduledDate,
            assigneeMemberId = assigneeMemberId,
        )

        taskExecutionRepository.create(taskExecution, session)
    }
}