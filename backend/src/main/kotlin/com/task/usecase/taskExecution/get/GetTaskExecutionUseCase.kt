package com.task.usecase.taskExecution.get

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import java.time.Instant

@ImplementedBy(GetTaskExecutionUseCaseImpl::class)
interface GetTaskExecutionUseCase {
    data class Input(
        val id: TaskExecutionId
    )

    data class Output(
        val id: TaskExecutionId,
        val taskDefinitionId: TaskDefinitionId,
        val scheduledDate: Instant,
        val status: String,
        val assigneeMemberIds: List<MemberId>,
        val startedAt: Instant?,
        val completedAt: Instant?,
        val snapshot: SnapshotOutput?
    )

    data class SnapshotOutput(
        val name: String,
        val description: String,
        val scheduledStartTime: Instant,
        val scheduledEndTime: Instant,
        val definitionVersion: Int,
        val capturedAt: Instant
    )

    fun execute(input: Input): Output?
}
