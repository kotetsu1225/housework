package com.task.infra.event

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.event.DomainEvent
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.event.DomainEventHandler
import org.jooq.DSLContext

@Singleton
class InMemoryDomainEventDispatcher @Inject constructor(
    handlers: Set<@JvmSuppressWildcards DomainEventHandler<*>>,
) : DomainEventDispatcher {
    private val handlerMap: Map<Class<*>, List<DomainEventHandler<*>>>
        = handlers.groupBy { it.eventType }

    override fun dispatchAll(events: List<DomainEvent>, session: DSLContext) {
        for (event in events) {
            dispatch(event, session)
        }
    }
    @Suppress("UNCHECKED_CAST")
    private fun dispatch(event: DomainEvent, session: DSLContext) {
        val eventHandlers = handlerMap[event::class.java] ?: return
        for (eventHandler in eventHandlers) {
            (eventHandler as DomainEventHandler<DomainEvent>).handle(event, session)
        }
    }
}