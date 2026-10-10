package com.task.scheduler

import com.task.usecase.batch.TenantBatchRunner
import com.task.usecase.task.SendNotDailyTomorrowTaskNotificationsUseCase
import com.task.usecase.task.SendNotDailyTomorrowTaskNotificationsUseCase.Input
import java.time.LocalDate
import java.time.LocalTime

class NotDailyTomorrowTaskNotificationScheduler (
    private val sendNotDailyTomorrowTaskNotificationsUseCase: SendNotDailyTomorrowTaskNotificationsUseCase,
    private val tenantBatchRunner: TenantBatchRunner,
    executionTime: LocalTime = LocalTime.of(20, 0)
): DailyScheduler(executionTime){

    override val taskName: String = "Tomorrow Task Notification"

    override fun doExecute(today: LocalDate): String {
        // ACTIVE な全テナントについて 1 テナントずつ送る。1 テナントの失敗は他テナントに影響しない(#60、ADR #19 決定 2)
        val summary = tenantBatchRunner.forEachActiveTenant(taskName) { tenantId ->
            sendNotDailyTomorrowTaskNotificationsUseCase.execute(Input(tenantId = tenantId, targetDate = today))
        }
        val partialFailures = summary.results.mapNotNull { (tenantId, result) ->
            (result.getOrNull() as? SendNotDailyTomorrowTaskNotificationsUseCase.ExecutionResult.Failed)
                ?.let { "tenantId=${tenantId.value}: ${it.status} - ${it.message}" }
        }
        return if (partialFailures.isEmpty()) {
            summary.toLogMessage()
        } else {
            "${summary.toLogMessage()}(送信失敗: ${partialFailures.joinToString(" / ")})"
        }
    }
}