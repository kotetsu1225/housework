package com.task.scheduler

import com.task.usecase.outbox.ProcessOutboxEventsUseCase
import java.time.LocalDateTime

class OutboxEventProcessorScheduler(
    private val processOutboxEventsUseCase: ProcessOutboxEventsUseCase,
    private val intervalSeconds: Long = 10
) : BaseScheduler() {

    override val taskName: String = "outbox event processing"

    override fun calculateNextRunTime(now: LocalDateTime): LocalDateTime {
        return now.plusSeconds(intervalSeconds)
    }

    override fun executeTask(): String {
        val output = processOutboxEventsUseCase.execute(
            ProcessOutboxEventsUseCase.Input(batchSize = 100)
        )
        return "Processed ${output.processedCount} event(s), failed ${output.failedCount}"
    }
}
