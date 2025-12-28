package com.task.domain

import com.task.domain.event.DomainEvent

abstract class AggregateRoot {
    private val _domainEvents = mutableListOf<DomainEvent>()

    // 読み取り用
    val domainEvents: List<DomainEvent>
        get() = _domainEvents.toList()

    protected fun addDomainEvent(event: DomainEvent) {
        _domainEvents.add(event)
    }

    fun clearDomainEvents() {
        _domainEvents.clear()
    }

}