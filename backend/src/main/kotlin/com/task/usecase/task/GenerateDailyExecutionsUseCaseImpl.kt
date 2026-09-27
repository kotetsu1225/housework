package com.task.usecase.task

import com.google.inject.Inject
import com.task.domain.task.service.TaskGenerationService
import com.task.infra.database.Database

class GenerateDailyExecutionsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskGenerationService: TaskGenerationService
) : GenerateDailyExecutionsUseCase {
    override fun execute(input: GenerateDailyExecutionsUseCase.Input): GenerateDailyExecutionsUseCase.Output {
        // 1テナント分だけをtenantスコープのtransactionで生成する(issue #57)。
        // RLSにより、このsessionではinput.tenantId自身の定義しか見えない/書けない。
        return database.withTransaction(input.tenantId) { session ->
            val generatedExecutions = taskGenerationService.generateDailyTaskExecution(
                input.targetDate,
                session
            )

            GenerateDailyExecutionsUseCase.Output(
                generatedCount = generatedExecutions.size,
                taskExecutionIds = generatedExecutions.map { it.id }
            )
        }
    }
}