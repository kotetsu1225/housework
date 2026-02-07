package com.task.infra.outbox

import java.time.Instant
import java.util.UUID

data class OutboxRecord(
    val id: UUID,
    val eventType: String,
    val aggregateType: String,
    val aggregateId: UUID,
    val payload: String,
    val status: OutboxStatus,
    val retryCount: Int,
    val maxRetries: Int,
    val createdAt: Instant,
    val processedAt: Instant?,
    val errorMessage: String?
) {
    companion object {
        fun create(
            eventType: String,
            aggregateType: String,
            aggregateId: UUID,
            payload: String,
            maxRetries: Int = 5
        ): OutboxRecord {
            return OutboxRecord(
                id = UUID.randomUUID(),
                eventType = eventType,
                aggregateType = aggregateType,
                aggregateId = aggregateId,
                payload = payload,
                status = OutboxStatus.PENDING,
                retryCount = 0,
                maxRetries = maxRetries,
                createdAt = Instant.now(),
                processedAt = null,
                errorMessage = null
            )
        }
    }

    fun markAsProcessed(): OutboxRecord {
        return this.copy(
            status = OutboxStatus.PROCESSED,
            processedAt = Instant.now()
        )
    }

    fun incrementRetry(errorMessage: String): OutboxRecord {
        val newRetryCount = this.retryCount + 1
        val newStatus = if (newRetryCount >= this.maxRetries) {
            OutboxStatus.FAILED
        } else {
            OutboxStatus.PENDING
        }
        return this.copy(
            retryCount = newRetryCount,
            status = newStatus,
            errorMessage = errorMessage
        )
    }
}

enum class OutboxStatus {
    PENDING,
    PROCESSED,
    FAILED
}
