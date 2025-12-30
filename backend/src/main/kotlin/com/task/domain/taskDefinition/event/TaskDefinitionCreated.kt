package com.task.domain.taskDefinition.event

import com.task.domain.event.DomainEvent
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import java.time.Instant

data class TaskDefinitionCreated(
    val taskDefinitionId: TaskDefinitionId,
    val name: TaskDefinitionName,
    val description: TaskDefinitionDescription,
    val scheduledTimeRange: ScheduledTimeRange,
    val scope: TaskScope,
    val ownerMemberId: MemberId? = null,
    val schedule: TaskSchedule,
    override val occurredAt: Instant = Instant.now(),
): DomainEvent
