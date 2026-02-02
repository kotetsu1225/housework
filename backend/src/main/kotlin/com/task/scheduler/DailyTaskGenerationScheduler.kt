package com.task.scheduler

import com.task.usecase.task.GenerateDailyExecutionsUseCase
import java.time.LocalDate
import java.time.LocalTime

class DailyTaskGenerationScheduler(
    private val generateDailyExecutionsUseCase: GenerateDailyExecutionsUseCase,
    executionTime: LocalTime = LocalTime.of(6, 0)
) : DailyScheduler(executionTime) {

    override val taskName: String = "daily task generation"

    override fun doExecute(today: LocalDate): String {
        val output = generateDailyExecutionsUseCase.execute(
            GenerateDailyExecutionsUseCase.Input(targetDate = today)
        )
        return "Generated ${output.generatedCount} task(s)"
    }
}
