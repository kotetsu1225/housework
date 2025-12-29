package com.task.infra.event

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.event.DomainEvent
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.event.DomainEventHandler
import org.jooq.DSLContext

@Singleton
class InMemoryDomainEventDispatcher @Inject constructor(
    private val handlers: Set<@JvmSuppressWildcards DomainEventHandler<*>>,
) : DomainEventDispatcher {

    override fun dispatchAll(events: List<DomainEvent>, session: DSLContext) {
        for (event in events) {
            dispatch(event, session)
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun dispatch(event: DomainEvent, session: DSLContext) {
        handlers.forEach { handler ->
            if (handler.eventType.isAssignableFrom(event::class.java)) {
                (handler as DomainEventHandler<DomainEvent>).handle(event, session)
            }
        }
    }
}