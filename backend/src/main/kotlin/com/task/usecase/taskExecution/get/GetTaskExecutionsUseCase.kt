package com.task.usecase.taskExecution.get

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import java.time.Instant

@ImplementedBy(GetTaskExecutionsUseCaseImpl::class)
interface GetTaskExecutionsUseCase {
    data class Input(
        val limit: Int = 20,
        val offset: Int = 0
    )

    data class Output(
        val items: List<TaskExecutionOutput>,
        val totalCount: Int
    )

    data class TaskExecutionOutput(
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
        val estimatedMinutes: Int,
        val definitionVersion: Int,
        val capturedAt: Instant
    )

    fun execute(input: Input): Output
}
