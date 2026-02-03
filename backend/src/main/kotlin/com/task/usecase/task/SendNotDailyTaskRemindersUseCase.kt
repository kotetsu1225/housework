package com.task.usecase.task

import com.google.inject.ImplementedBy
import java.time.Instant

/**
 * 非毎日タスクのリマインダー通知を送信するUseCase
 *
 * 対象:
 * - 当日のTaskExecutionが存在するNotStartedな非毎日タスク
 * - scheduledTimeRange.startTimeの約1時間前
 *
 * 通知先:
 * - FAMILY scope → 全メンバー
 * - PERSONAL scope → ownerMemberIdのみ
 */
@ImplementedBy(SendNotDailyTaskRemindersUseCaseImpl::class)
interface SendNotDailyTaskRemindersUseCase {
    data class Input(
        val now: Instant
    )

    sealed class ExecutionResult {
        data object Success : ExecutionResult()
        data class Failed(val status: String, val message: String) : ExecutionResult()
    }

    fun execute(input: Input): ExecutionResult
}
