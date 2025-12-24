package com.task.usecase.taskDefinition.update

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*

@ImplementedBy(UpdateTaskDefinitionUseCaseImpl::class)
interface UpdateTaskDefinitionUseCase {
    data class Input(
        val id: TaskDefinitionId,
        val name: TaskDefinitionName? = null,
        val description: TaskDefinitionDescription? = null,
        val estimatedMinutes: Int? = null,
        val scope: TaskScope? = null,
        val ownerMemberId: MemberId? = null,
        val schedule: TaskSchedule? = null,
    )

    data class Output(
        val id: TaskDefinitionId,
        val name: TaskDefinitionName,
        val description: TaskDefinitionDescription,
        val estimatedMinutes: Int,
        val scope: TaskScope,
        val ownerMemberId: MemberId?,
        val schedule: TaskSchedule,
        val version: Int,
    )

    fun execute(input: Input): Output
}
