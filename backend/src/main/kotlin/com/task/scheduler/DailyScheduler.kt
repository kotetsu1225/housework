package com.task.scheduler

import com.task.domain.AppTimeZone
import kotlinx.coroutines.*
import org.slf4j.LoggerFactory
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

abstract class DailyScheduler(
    private val executionTime: LocalTime
) {
    private val logger = LoggerFactory.getLogger(this::class.java)
    private var job: Job? = null

    /** タスク名（ログ出力用） */
    protected abstract val taskName: String

    /**
     * タスクを実行し、結果の説明文字列を返す
     * @param today 実行対象日
     * @return 実行結果の説明（例: "Generated 5 task(s)"）
     */
    protected abstract fun doExecute(today: LocalDate): String

    fun start(scope: CoroutineScope) {
        job = scope.launch {
            logger.info("${this@DailyScheduler::class.simpleName} started. Execution time: $executionTime")

            while (isActive) {
                val now = LocalDateTime.now(AppTimeZone.ZONE)
                val nextRun = calculateNextRunTime(now)
                val delayMillis = Duration.between(now, nextRun).toMillis()

                logger.info("Next $taskName scheduled at: $nextRun (in ${delayMillis / 1000} seconds)")
                delay(delayMillis)

                if (isActive) {
                    runTask()
                }
            }
        }
    }

    fun stop() {
        job?.cancel()
        logger.info("${this::class.simpleName} stopped")
    }

    private fun calculateNextRunTime(now: LocalDateTime): LocalDateTime {
        val todayExecution = now.toLocalDate().atTime(executionTime)
        return if (now.isBefore(todayExecution)) {
            todayExecution
        } else {
            todayExecution.plusDays(1)
        }
    }

    private fun runTask() {
        val today = LocalDate.now(AppTimeZone.ZONE)
        try {
            logger.info("Starting $taskName for: $today")
            val result = doExecute(today)
            logger.info("$taskName completed. $result")
        } catch (e: Exception) {
            logger.error("Error while executing $taskName", e)
        }
    }
}
