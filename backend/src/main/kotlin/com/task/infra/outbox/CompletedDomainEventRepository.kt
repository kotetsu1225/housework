package com.task.infra.outbox

import org.jooq.DSLContext
import java.util.UUID

interface CompletedDomainEventRepository {
    fun exists(eventId: UUID, session: DSLContext): Boolean
    fun save(eventId: UUID, eventType: String, session: DSLContext)
}
