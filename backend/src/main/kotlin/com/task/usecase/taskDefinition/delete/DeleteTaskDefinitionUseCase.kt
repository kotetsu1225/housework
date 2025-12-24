package com.task.usecase.taskDefinition.delete

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope

@ImplementedBy(DeleteTaskDefinitionUseCaseImpl::class)
interface DeleteTaskDefinitionUseCase {
    data class Input(
        val id: TaskDefinitionId,
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
