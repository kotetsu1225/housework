package com.task.scheduler

import com.task.domain.AppTimeZone
import java.time.Instant
import java.time.LocalDateTime

/**
 * 指定間隔で繰り返し実行するスケジューラー
 *
 * @param intervalMinutes 実行間隔（分）
 */
abstract class IntervalScheduler(
    private val intervalMinutes: Long
) : BaseScheduler() {

    /**
     * タスクを実行し、結果の説明文字列を返す
     * @param now 実行時点の時刻
     * @return 実行結果の説明（例: "Sent 3 notification(s)"）
     */
    protected abstract fun doExecute(now: Instant): String

    override fun calculateNextRunTime(now: LocalDateTime): LocalDateTime {
        return now.plusMinutes(intervalMinutes)
    }

    override fun executeTask(): String {
        val now = Instant.now()
        return doExecute(now)
    }
}
