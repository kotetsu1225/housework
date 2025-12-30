package com.task.usecase.taskExecution.assign

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import java.time.Instant

@ImplementedBy(AssignTaskExecutionUseCaseImpl::class)
interface AssignTaskExecutionUseCase {
    data class Input(
        val id: TaskExecutionId,
        val newAssigneeMemberId: MemberId,
    )

    data class Output(
        val id: TaskExecutionId,
        val taskDefinitionId: TaskDefinitionId,
        val scheduledDate: Instant,
        val status: String,
        val assigneeMemberId: MemberId?,
        val startedAt: Instant?,
        val completedAt: Instant?,
        val completedByMemberId: MemberId?,
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

    fun execute(input: Input): Output
}
