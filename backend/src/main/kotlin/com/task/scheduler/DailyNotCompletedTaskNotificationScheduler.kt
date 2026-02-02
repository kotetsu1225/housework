package com.task.scheduler

import com.task.usecase.task.SendDailyNotCompletedTaskNotificationsUseCase
import com.task.usecase.task.SendDailyNotCompletedTaskNotificationsUseCase.ExecutionResult
import java.time.LocalDate
import java.time.LocalTime

class DailyNotCompletedTaskNotificationScheduler(
    private val sendDailyNotCompletedTaskNotificationsUseCase: SendDailyNotCompletedTaskNotificationsUseCase,
    executionTime: LocalTime = LocalTime.of(19, 0)
) : DailyScheduler(executionTime) {

    override val taskName: String = "daily notification"

    override fun doExecute(today: LocalDate): String {
        val result = sendDailyNotCompletedTaskNotificationsUseCase.execute(
            SendDailyNotCompletedTaskNotificationsUseCase.Input(targetDate = today)
        )
        return when (result) {
            is ExecutionResult.Success -> "completed successfully"
            is ExecutionResult.Failed -> "failed: ${result.status} - ${result.message}"
        }
    }
}
