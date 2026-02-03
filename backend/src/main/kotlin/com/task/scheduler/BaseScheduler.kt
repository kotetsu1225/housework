package com.task.scheduler

import com.task.domain.AppTimeZone
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.time.Duration
import java.time.LocalDateTime

/**
 * スケジューラーの共通基底クラス
 *
 * 共通処理:
 * - コルーチンベースの無限ループ実行
 * - 次回実行時刻までのdelay
 * - start/stop のライフサイクル管理
 * - ログ出力
 *
 * サブクラスで実装すべきメソッド:
 * - taskName: ログ出力用のタスク名
 * - calculateNextRunTime: 次回実行時刻の計算ロジック
 * - executeTask: 実際のタスク実行ロジック
 */
abstract class BaseScheduler {
    private val logger = LoggerFactory.getLogger(this::class.java)
    private var job: Job? = null

    /** タスク名（ログ出力用） */
    protected abstract val taskName: String

    /**
     * 次回実行時刻を計算する
     * @param now 現在時刻
     * @return 次回実行時刻
     */
    protected abstract fun calculateNextRunTime(now: LocalDateTime): LocalDateTime

    /**
     * タスクを実行し、結果の説明文字列を返す
     * @return 実行結果の説明（例: "Sent 3 notification(s)"）
     */
    protected abstract fun executeTask(): String

    fun start(scope: CoroutineScope) {
        job = scope.launch {
            logger.info("${this@BaseScheduler::class.simpleName} started")

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

    private fun runTask() {
        try {
            logger.info("Starting $taskName")
            val result = executeTask()
            logger.info("$taskName completed. $result")
        } catch (e: Exception) {
            logger.error("Error while executing $taskName", e)
        }
    }
}
