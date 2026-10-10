package com.task.scheduler

import com.task.usecase.batch.TenantBatchRunner
import com.task.usecase.task.SendNotDailyTaskRemindersUseCase
import com.task.usecase.task.SendNotDailyTaskRemindersUseCase.ExecutionResult
import java.time.Instant

/**
 * 非毎日タスクのリマインダー通知スケジューラー
 *
 * 5分間隔で実行し、約1時間後にstartTimeを迎えるタスクの通知を送信する
 *
 * @param sendNotDailyTaskRemindersUseCase リマインダー通知を送信するUseCase
 * @param intervalMinutes 実行間隔（分）。デフォルト5分
 */
class NotDailyTaskReminderScheduler(
    private val sendNotDailyTaskRemindersUseCase: SendNotDailyTaskRemindersUseCase,
    private val tenantBatchRunner: TenantBatchRunner,
    intervalMinutes: Long = 5
) : IntervalScheduler(intervalMinutes) {

    override val taskName: String = "not-daily task reminder"

    override fun doExecute(now: Instant): String {
        // ACTIVE な全テナントについて 1 テナントずつ送る。1 テナントの失敗は他テナントに影響しない(#59、ADR #19 決定 2)
        val summary = tenantBatchRunner.forEachActiveTenant(taskName) { tenantId ->
            sendNotDailyTaskRemindersUseCase.execute(
                SendNotDailyTaskRemindersUseCase.Input(tenantId = tenantId, now = now)
            )
        }
        val partialFailures = summary.results.mapNotNull { (tenantId, result) ->
            (result.getOrNull() as? ExecutionResult.Failed)
                ?.let { "tenantId=${tenantId.value}: ${it.status} - ${it.message}" }
        }
        return if (partialFailures.isEmpty()) {
            summary.toLogMessage()
        } else {
            "${summary.toLogMessage()}(送信失敗: ${partialFailures.joinToString(" / ")})"
        }
    }
}
