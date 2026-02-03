package com.task.scheduler

import com.task.domain.AppTimeZone
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/**
 * 毎日特定の時刻に実行するスケジューラー
 *
 * @param executionTime 実行時刻（例: LocalTime.of(19, 0) で19:00に実行）
 */
abstract class DailyScheduler(
    private val executionTime: LocalTime
) : BaseScheduler() {

    /**
     * タスクを実行し、結果の説明文字列を返す
     * @param today 実行対象日
     * @return 実行結果の説明（例: "Generated 5 task(s)"）
     */
    protected abstract fun doExecute(today: LocalDate): String

    override fun calculateNextRunTime(now: LocalDateTime): LocalDateTime {
        val todayExecution = now.toLocalDate().atTime(executionTime)
        return if (now.isBefore(todayExecution)) {
            todayExecution
        } else {
            todayExecution.plusDays(1)
        }
    }

    override fun executeTask(): String {
        val today = LocalDate.now(AppTimeZone.ZONE)
        return doExecute(today)
    }
}
