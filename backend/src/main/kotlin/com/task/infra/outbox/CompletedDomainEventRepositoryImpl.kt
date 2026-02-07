package com.task.infra.outbox

import com.google.inject.Singleton
import com.task.infra.database.jooq.tables.CompletedDomainEvents.Companion.COMPLETED_DOMAIN_EVENTS
import org.jooq.DSLContext
import java.time.OffsetDateTime
import java.util.UUID

@Singleton
class CompletedDomainEventRepositoryImpl : CompletedDomainEventRepository {

    override fun exists(eventId: UUID, session: DSLContext): Boolean {
        return session.fetchExists(
            session.selectFrom(COMPLETED_DOMAIN_EVENTS)
                .where(COMPLETED_DOMAIN_EVENTS.EVENT_ID.eq(eventId))
        )
    }

    override fun save(eventId: UUID, eventType: String, session: DSLContext) {
        session.insertInto(COMPLETED_DOMAIN_EVENTS)
            .set(COMPLETED_DOMAIN_EVENTS.EVENT_ID, eventId)
            .set(COMPLETED_DOMAIN_EVENTS.EVENT_TYPE, eventType)
            .set(COMPLETED_DOMAIN_EVENTS.PROCESSED_AT, OffsetDateTime.now())
            .onConflictDoNothing()
            .execute()
    }
}
