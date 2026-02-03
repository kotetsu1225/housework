package com.task.scheduler

import com.task.usecase.task.SendNotDailyTomorrowTaskNotificationsUseCase
import com.task.usecase.task.SendNotDailyTomorrowTaskNotificationsUseCase.Input
import java.time.LocalDate
import java.time.LocalTime

class NotDailyTomorrowTaskNotificationScheduler (
    private val sendNotDailyTomorrowTaskNotificationsUseCase: SendNotDailyTomorrowTaskNotificationsUseCase,
    executionTime: LocalTime = LocalTime.of(20, 0)
): DailyScheduler(executionTime){

    override val taskName: String = "Tomorrow Task Notification"

    override fun doExecute(today: LocalDate): String {
        val result = sendNotDailyTomorrowTaskNotificationsUseCase.execute(
            Input(today)
        )

        return when (result) {
            is SendNotDailyTomorrowTaskNotificationsUseCase.ExecutionResult.Success -> "completed successfully"
            is SendNotDailyTomorrowTaskNotificationsUseCase.ExecutionResult.Failed -> "failed: ${result.status} - ${result.message}"
        }
    }
}