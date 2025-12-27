package com.task.usecase.taskExecution.create

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import java.time.Instant

@ImplementedBy(CreateTaskExecutionUseCaseImpl::class)
interface CreateTaskExecutionUseCase {
    data class Input(
        val taskDefinition: TaskDefinition,
        val scheduledDate: Instant
    )

    data class Output(
        val id: TaskExecutionId,
        val taskDefinitionId: TaskDefinitionId,
        val assigneeMemberId: MemberId?,
        val scheduledDate: Instant,
    )

    fun execute(input: Input): Output
}
