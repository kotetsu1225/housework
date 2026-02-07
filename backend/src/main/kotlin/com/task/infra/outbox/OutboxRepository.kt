package com.task.infra.outbox

import org.jooq.DSLContext
import java.util.UUID

interface OutboxRepository {
    fun save(record: OutboxRecord, session: DSLContext): OutboxRecord
    fun findPending(session: DSLContext, limit: Int = 100): List<OutboxRecord>
    fun update(record: OutboxRecord, session: DSLContext): OutboxRecord
    fun findById(id: UUID, session: DSLContext): OutboxRecord?
}
