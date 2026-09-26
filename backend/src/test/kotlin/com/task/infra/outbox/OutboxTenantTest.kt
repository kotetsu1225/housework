package com.task.infra.outbox

import com.task.domain.tenant.TenantId
import com.task.infra.database.jooq.tables.references.COMPLETED_DOMAIN_EVENTS
import com.task.infra.database.jooq.tables.references.OUTBOX
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.support.PostgresTestDatabase
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * issue #49 の受け入れ条件を実DBで確かめる。
 * tenant はドメインイベントのpayloadではなく、outbox / completed_domain_eventsの
 * `tenant_id`列(エンベロープ)で運ぶ方式(OutboxRecord.ktのKDoc参照)。
 */
class OutboxTenantTest {

    private val outboxRepository = OutboxRepositoryImpl()
    private val completedDomainEventRepository = CompletedDomainEventRepositoryImpl()

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun createTenant(familyName: String, email: String): TenantId {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantId = TenantId.generate()
        owner.insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, familyName)
            .set(TENANTS.EMAIL, email)
            .execute()
        return tenantId
    }

    @Test
    fun `outboxのsaveでtenant_idが保存され、findPendingでも同じtenantIdに復元される`() {
        val tenantId = createTenant("山田家", "yamada@example.com")
        val record = OutboxRecord.create(
            tenantId = tenantId,
            eventType = "TaskDefinitionDeleted",
            aggregateType = "TaskDefinition",
            aggregateId = UUID.randomUUID(),
            payload = "{}",
        )

        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            outboxRepository.save(record, session)
        }

        val owner = PostgresTestDatabase.ownerDsl()
        val storedTenantId = owner.select(OUTBOX.TENANT_ID).from(OUTBOX)
            .where(OUTBOX.ID.eq(record.id)).fetchOne(OUTBOX.TENANT_ID)
        assertEquals(tenantId.value, storedTenantId)

        val pending = outboxRepository.findPending(owner)
        val found = pending.first { it.id == record.id }
        assertEquals(tenantId, found.tenantId)
    }

    @Test
    fun `completedDomainEventsのsaveでtenant_idが保存され、同じeventIdを再度saveしても例外にならない`() {
        val tenantId = createTenant("佐藤家", "sato@example.com")
        val eventId = UUID.randomUUID()

        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            completedDomainEventRepository.save(eventId, "TaskDefinitionDeleted", tenantId, session)
        }

        val owner = PostgresTestDatabase.ownerDsl()
        val storedTenantId = owner.select(COMPLETED_DOMAIN_EVENTS.TENANT_ID).from(COMPLETED_DOMAIN_EVENTS)
            .where(COMPLETED_DOMAIN_EVENTS.EVENT_ID.eq(eventId)).fetchOne(COMPLETED_DOMAIN_EVENTS.TENANT_ID)
        assertEquals(tenantId.value, storedTenantId)

        assertDoesNotThrow {
            PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
                completedDomainEventRepository.save(eventId, "TaskDefinitionDeleted", tenantId, session)
            }
        }
    }

    @Test
    fun `別tenantのスコープからは他tenantのoutbox行が見えない`() {
        val tenantA = createTenant("田中家", "tanaka@example.com")
        val tenantB = createTenant("鈴木家", "suzuki@example.com")

        val record = OutboxRecord.create(
            tenantId = tenantA,
            eventType = "TaskDefinitionDeleted",
            aggregateType = "TaskDefinition",
            aggregateId = UUID.randomUUID(),
            payload = "{}",
        )
        PostgresTestDatabase.inTenantTransaction(tenantA) { session ->
            outboxRepository.save(record, session)
        }

        val pendingForB = PostgresTestDatabase.inTenantTransaction(tenantB) { session ->
            outboxRepository.findPending(session)
        }
        assertTrue(pendingForB.isEmpty())
    }
}
