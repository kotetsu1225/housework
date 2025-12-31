package com.task.scheduler

import com.task.domain.AppTimeZone
import com.task.usecase.task.GenerateDailyExecutionsUseCase
import kotlinx.coroutines.*
import org.slf4j.LoggerFactory
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class DailyTaskGenerationScheduler (
    private val generateDailyExecutionsUseCase: GenerateDailyExecutionsUseCase,
    private val executionTime: LocalTime = LocalTime.of(13, 0)
){
    private val logger = LoggerFactory.getLogger(DailyTaskGenerationScheduler::class.java)
    private var job: Job? = null

    fun start(scope: CoroutineScope) {
        job = scope.launch {
            logger.info("DailyTaskGenerationScheduler started. Execution time: $executionTime")

            while (isActive) {
                val now = LocalDateTime.now(AppTimeZone.ZONE)
                val nextRun = calculateNextRunTime(now)
                val delayMillis = Duration.between(now, nextRun).toMillis()

                logger.info("Next task generation scheduled at: $nextRun (in ${delayMillis / 1000} seconds)")
                delay(delayMillis)

                if (isActive) {                          // キャンセルされていなければ実行
                    executeGeneration()
                }
            }
        }
    }

    fun stop() {
        job?.cancel()
        logger.info("DailyTaskGenerationScheduler stopped")
    }

    private fun calculateNextRunTime(now: LocalDateTime): LocalDateTime {
        val todayExecution = now.toLocalDate().atTime(executionTime)

        return if (now.isBefore(todayExecution)) {
            todayExecution
        } else {
            todayExecution.plusDays(1)
        }
    }

    private fun executeGeneration() {
        try {
            val today = LocalDate.now(AppTimeZone.ZONE)
            logger.info("Starting daily task generation for: $today")

            val generateOutput = generateDailyExecutionsUseCase.execute(
                GenerateDailyExecutionsUseCase.Input(
                    targetDate = today
                )
            )

            logger.info("Daily task generation completed. Generated ${generateOutput.generatedCount} task(s)")
        } catch (e: Exception) {
            logger.error("Error while generating daily task", e)
        }
    }

}