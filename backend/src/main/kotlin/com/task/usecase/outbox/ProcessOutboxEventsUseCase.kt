package com.task.usecase.outbox

interface ProcessOutboxEventsUseCase {
    data class Input(
        val batchSize: Int = 100
    )

    data class Output(
        val processedCount: Int,
        val failedCount: Int
    )

    fun execute(input: Input = Input()): Output
}
