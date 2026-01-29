package com.task.domain.taskExecution.event

import com.task.domain.event.DomainEvent
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskExecution.TaskExecutionId
import java.time.Instant

sealed interface TaskExecutionEvent: DomainEvent {
    val taskExecutionId: TaskExecutionId
    val taskName: TaskDefinitionName
}

data class TaskExecutionCreated(
    override val taskExecutionId: TaskExecutionId,
    override val taskName: TaskDefinitionName,
    override val occurredAt: Instant
) : TaskExecutionEvent

data class TaskExecutionStarted(
    override val taskExecutionId: TaskExecutionId,
    val assigneeMemberIds: List<MemberId>,
    override val taskName: TaskDefinitionName,
    override val occurredAt: Instant
) : TaskExecutionEvent

data class TaskExecutionCompleted(
    override val taskExecutionId: TaskExecutionId,
    val assigneeMemberIds: List<MemberId>,
    override val taskName: TaskDefinitionName,
    override val occurredAt: Instant
) : TaskExecutionEvent

data class TaskExecutionCancelled(
    override val taskExecutionId: TaskExecutionId,
    override val taskName: TaskDefinitionName,
    override val occurredAt: Instant
) : TaskExecutionEvent
