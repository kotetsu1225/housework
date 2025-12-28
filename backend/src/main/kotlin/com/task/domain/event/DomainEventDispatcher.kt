package com.task.domain.event

import org.jooq.DSLContext

interface DomainEventDispatcher {
    fun dispatchAll(events: List<DomainEvent>, session: DSLContext)
}