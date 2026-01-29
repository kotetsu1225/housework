package com.task.usecase.taskExecution.complete

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.taskExecution.TaskSnapshot
import java.time.Instant

@ImplementedBy(CompleteTaskExecutionUseCaseImpl::class)
interface CompleteTaskExecutionUseCase {
    data class Input(
        val id: TaskExecutionId,
        val completedMemberId: MemberId,
    )

    data class Output(
        val id: TaskExecutionId,
        val taskDefinitionId: TaskDefinitionId,
        val scheduledDate: Instant,
        val taskSnapshot: TaskSnapshot,
        val assigneeMemberId: MemberId,
        val startedAt: Instant,
        val completedAt: Instant,
        val completedMemberId: MemberId,
    )

    fun execute(input: Input): Output
}
