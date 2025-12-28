package com.task.domain.event

import java.time.Instant

interface DomainEvent {
    val occurredAt: Instant
}