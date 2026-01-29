package com.task.usecase.taskDefinition.get

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*


@ImplementedBy(GetTaskDefinitionsUseCaseImpl::class)
interface GetTaskDefinitionsUseCase {
    data class Input(
        val limit: Int = 20,
        val offset: Int = 0
    )

    data class Output(
        val taskDefinitions: List<TaskDefinitionOutput>,
        val total: Int,
        val hasMore: Boolean
    )

    data class TaskDefinitionOutput(
        val id: TaskDefinitionId,
        val name: TaskDefinitionName,
        val description: TaskDefinitionDescription,
        val scheduledTimeRange: ScheduledTimeRange,
        val scope: TaskScope,
        val ownerMemberId: MemberId?,
        val schedule: TaskSchedule,
        val version: Int
    )

    fun execute(input: Input): Output
}
