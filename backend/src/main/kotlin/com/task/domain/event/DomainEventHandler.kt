package com.task.domain.event

import org.jooq.DSLContext

interface DomainEventHandler<E: DomainEvent> {
    val eventType: Class<E>
    fun handle(event: E, session: DSLContext)
}