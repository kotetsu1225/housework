package com.task.domain.taskExecution.event

import com.task.domain.event.DomainEvent
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskExecution.TaskExecutionId
import java.time.Instant

sealed interface TaskExecutionEvent: DomainEvent {
    val taskExecutionId: TaskExecutionId
}

data class TaskExecutionStarted(
    override val taskExecutionId: TaskExecutionId,
    val assigneeMemberId: MemberId? = null,
    val taskName: TaskDefinitionName,
    override val occurredAt: Instant
) : TaskExecutionEvent

data class TaskExecutionCompleted(
    override val taskExecutionId: TaskExecutionId,
    val completedByMemberId: MemberId,
    override val occurredAt: Instant
) : TaskExecutionEvent

data class TaskExecutionCancelled(
    override val taskExecutionId: TaskExecutionId,
    override val occurredAt: Instant
) : TaskExecutionEvent
