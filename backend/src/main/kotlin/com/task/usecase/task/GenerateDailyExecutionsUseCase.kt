package com.task.usecase.task

import com.google.inject.ImplementedBy
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.tenant.TenantId
import java.time.LocalDate

@ImplementedBy(GenerateDailyExecutionsUseCaseImpl::class)
interface GenerateDailyExecutionsUseCase {
    data class Input(
        val tenantId: TenantId,
        val targetDate: LocalDate
    )

    data class Output(
        val generatedCount: Int,
        val taskExecutionIds: List<TaskExecutionId>
    )

    fun execute(input: Input): Output
}