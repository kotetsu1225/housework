package com.task.usecase.task

import com.google.inject.Inject
import com.task.domain.task.service.TaskGenerationService
import com.task.infra.database.Database

class GenerateDailyExecutionsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskGenerationService: TaskGenerationService
) : GenerateDailyExecutionsUseCase {
    override fun execute(input: GenerateDailyExecutionsUseCase.Input): GenerateDailyExecutionsUseCase.Output {
        return database.withTransaction { session ->
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