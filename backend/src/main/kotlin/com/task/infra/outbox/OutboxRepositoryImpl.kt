package com.task.infra.outbox

import com.google.inject.Singleton
import com.task.domain.AppTimeZone
import com.task.infra.database.jooq.tables.Outbox.Companion.OUTBOX
import org.jooq.DSLContext
import org.jooq.JSONB
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

@Singleton
class OutboxRepositoryImpl : OutboxRepository {

    private fun Instant.toOffsetDateTime(): OffsetDateTime =
        this.atZone(AppTimeZone.ZONE).toOffsetDateTime()

    private fun OffsetDateTime.toDomainInstant(): Instant = this.toInstant()

    override fun save(record: OutboxRecord, session: DSLContext): OutboxRecord {
        session.insertInto(OUTBOX)
            .set(OUTBOX.ID, record.id)
            .set(OUTBOX.EVENT_TYPE, record.eventType)
            .set(OUTBOX.AGGREGATE_TYPE, record.aggregateType)
            .set(OUTBOX.AGGREGATE_ID, record.aggregateId)
            .set(OUTBOX.PAYLOAD, JSONB.valueOf(record.payload))
            .set(OUTBOX.STATUS, record.status.name)
            .set(OUTBOX.RETRY_COUNT, record.retryCount)
            .set(OUTBOX.MAX_RETRIES, record.maxRetries)
            .set(OUTBOX.CREATED_AT, record.createdAt.toOffsetDateTime())
            .set(OUTBOX.PROCESSED_AT, record.processedAt?.toOffsetDateTime())
            .set(OUTBOX.ERROR_MESSAGE, record.errorMessage)
            .execute()

        return record
    }

    override fun findPending(session: DSLContext, limit: Int): List<OutboxRecord> {
        return session.selectFrom(OUTBOX)
            .where(OUTBOX.STATUS.eq(OutboxStatus.PENDING.name))
            .orderBy(OUTBOX.CREATED_AT.asc())
            .limit(limit)
            .fetch { record ->
                OutboxRecord(
                    id = record.id!!,
                    eventType = record.eventType!!,
                    aggregateType = record.aggregateType!!,
                    aggregateId = record.aggregateId!!,
                    payload = record.payload!!.data(),
                    status = OutboxStatus.valueOf(record.status!!),
                    retryCount = record.retryCount!!,
                    maxRetries = record.maxRetries!!,
                    createdAt = record.createdAt!!.toDomainInstant(),
                    processedAt = record.processedAt?.toDomainInstant(),
                    errorMessage = record.errorMessage
                )
            }
    }

    override fun update(record: OutboxRecord, session: DSLContext): OutboxRecord {
        session.update(OUTBOX)
            .set(OUTBOX.STATUS, record.status.name)
            .set(OUTBOX.RETRY_COUNT, record.retryCount)
            .set(OUTBOX.PROCESSED_AT, record.processedAt?.toOffsetDateTime())
            .set(OUTBOX.ERROR_MESSAGE, record.errorMessage)
            .where(OUTBOX.ID.eq(record.id))
            .execute()

        return record
    }

    override fun findById(id: UUID, session: DSLContext): OutboxRecord? {
        return session.selectFrom(OUTBOX)
            .where(OUTBOX.ID.eq(id))
            .fetchOne { record ->
                OutboxRecord(
                    id = record.id!!,
                    eventType = record.eventType!!,
                    aggregateType = record.aggregateType!!,
                    aggregateId = record.aggregateId!!,
                    payload = record.payload!!.data(),
                    status = OutboxStatus.valueOf(record.status!!),
                    retryCount = record.retryCount!!,
                    maxRetries = record.maxRetries!!,
                    createdAt = record.createdAt!!.toDomainInstant(),
                    processedAt = record.processedAt?.toDomainInstant(),
                    errorMessage = record.errorMessage
                )
            }
    }
}
