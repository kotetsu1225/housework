package com.task.usecase.outbox

interface RelayOutboxEventsUseCase {
    data class Input(
        val batchSize: Int = 100
    )

    data class Output(
        val publishedCount: Int,
        val failedCount: Int
    )

    fun execute(input: Input = Input()): Output
}
