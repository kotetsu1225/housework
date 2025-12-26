package com.task.usecase.taskDefinition.get

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*

@ImplementedBy(GetTaskDefinitionUseCaseImpl::class)
interface GetTaskDefinitionUseCase {
    data class Input(
        val id: TaskDefinitionId
    )

    data class Output(
        val id: TaskDefinitionId,
        val name: TaskDefinitionName,
        val description: TaskDefinitionDescription,
        val estimatedMinutes: Int,
        val scope: TaskScope,
        val ownerMemberId: MemberId?,
        val schedule: TaskSchedule,
        val version: Int
    )

    fun execute(input: Input): Output?
}
