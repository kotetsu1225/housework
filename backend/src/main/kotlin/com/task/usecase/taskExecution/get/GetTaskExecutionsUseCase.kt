package com.task.usecase.taskExecution.get

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskExecution.TaskExecutionId
import java.time.Instant
import java.time.LocalDate

@ImplementedBy(GetTaskExecutionsUseCaseImpl::class)
interface GetTaskExecutionsUseCase {

    data class FilterSpec(
        val scheduledDate: LocalDate? = null,
        val status: String? = null,
        val assigneeMemberIds: List<MemberId>? = null
    ) {
        companion object {
            fun empty() = FilterSpec()
        }

        fun isEmpty(): Boolean = scheduledDate == null && status == null && assigneeMemberIds == null
    }

    data class Input(
        val limit: Int = 20,
        val offset: Int = 0,
        val filter: FilterSpec = FilterSpec.empty()
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

    fun execute(input: Input): Output
}
