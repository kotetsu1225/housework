package com.task.usecase.taskDefinition.create

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*

@ImplementedBy(CreateTaskDefinitionUseCaseImpl::class)
interface CreateTaskDefinitionUseCase {
    data class Input(
        val name: TaskDefinitionName,
        val description: TaskDefinitionDescription,
        val scheduledTimeRange: ScheduledTimeRange,
        val scope: TaskScope,
        val ownerMemberId: MemberId?,
        val schedule: TaskSchedule,
    )

    data class Output(
        val id: TaskDefinitionId,
        val name: TaskDefinitionName,
        val description: TaskDefinitionDescription,
        val scheduledTimeRange: ScheduledTimeRange,
        val scope: TaskScope,
        val ownerMemberId: MemberId?,
        val schedule: TaskSchedule,
        val version: Int,
    )

    fun execute(input: Input): Output
}
