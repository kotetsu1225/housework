package com.task.usecase.taskExecution.start

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.taskExecution.TaskSnapshot
import java.time.Instant

@ImplementedBy(StartTaskExecutionUseCaseImpl::class)
interface StartTaskExecutionUseCase {
    data class Input(
        val id: TaskExecutionId,
        val assigneeMemberIds: List<MemberId>,
    )

    data class Output(
        val id: TaskExecutionId,
        val taskDefinitionId: TaskDefinitionId,
        val assigneeMemberIds: List<MemberId>,
        val taskSnapshot: TaskSnapshot,
        val scheduledDate: Instant,
        val startedAt: Instant
    )

    fun execute(input: Input): Output
}
