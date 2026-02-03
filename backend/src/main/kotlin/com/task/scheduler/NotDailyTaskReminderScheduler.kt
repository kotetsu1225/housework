package com.task.scheduler

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
    intervalMinutes: Long = 5
) : IntervalScheduler(intervalMinutes) {

    override val taskName: String = "not-daily task reminder"

    override fun doExecute(now: Instant): String {
        val result = sendNotDailyTaskRemindersUseCase.execute(
            SendNotDailyTaskRemindersUseCase.Input(now = now)
        )
        return when (result) {
            is ExecutionResult.Success -> "completed successfully"
            is ExecutionResult.Failed -> "failed: ${result.status} - ${result.message}"
        }
    }
}
