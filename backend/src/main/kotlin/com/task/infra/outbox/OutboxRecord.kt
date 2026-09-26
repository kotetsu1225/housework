package com.task.infra.outbox

import com.task.domain.tenant.TenantId
import java.time.Instant
import java.util.UUID

/**
 * outbox 1行分のレコード。
 *
 * 【tenant の運び方(issue #49・エンベロープ方式)】
 * tenant はドメインイベントの payload には含めず、この [tenantId](= outbox 行の
 * `tenant_id` 列)で運ぶ。理由は3つ:
 * 1. outbox に書く時点で、対象の集約(例: `TaskDefinition.tenantId`)から確実に取れる。
 * 2. 処理側(#61)は payload をデシリアライズする前に、行の `tenant_id` から
 *    tenant スコープの transaction を開ける。
 * 3. プロセス内ハンドラは既に tenant スコープの `session` を受け取るため、
 *    イベント自体に tenant を持たせる必要が無い。
 *
 * Pub/Sub に載せる際(#72、ハンドオフ §7.4)も、この tenantId は payload ではなく
 * message attribute `tenantId` として運ぶ。
 */
data class OutboxRecord(
    val id: UUID,
    val tenantId: TenantId,
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
            tenantId: TenantId,
            eventType: String,
            aggregateType: String,
            aggregateId: UUID,
            payload: String,
            maxRetries: Int = 5
        ): OutboxRecord {
            return OutboxRecord(
                id = UUID.randomUUID(),
                tenantId = tenantId,
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
