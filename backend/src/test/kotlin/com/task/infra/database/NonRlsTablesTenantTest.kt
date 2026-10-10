package com.task.infra.database

import com.task.infra.database.jooq.tables.references.COMPLETED_DOMAIN_EVENTS
import com.task.infra.database.jooq.tables.references.OUTBOX
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.infra.outbox.CompletedDomainEventRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import org.jooq.exception.DataAccessException
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.util.UUID

/**
 * #66 の DB レベルの項目のうち、V24(#38)で RLS を付けた tenants / outbox / completed_domain_events を確かめる。
 * (#38 では psql で手動確認していたものを自動テストにする)
 * - housework_app からは他テナントの completed_domain_events / tenants の行が見えない(outbox は OutboxTenantTest)
 * - housework_app は tenants に INSERT / UPDATE / DELETE できない(権限ごと剥奪)
 * - テナント未設定では 3 テーブルともエラー(fail-closed)
 */
class NonRlsTablesTenantTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun isRejected(e: DataAccessException, vararg markers: String): Boolean {
        val messages = generateSequence<Throwable>(e) { it.cause }.mapNotNull { it.message }.joinToString(" | ")
        return markers.any { it in messages }
    }

    @Test
    fun `tenants は自分の家族の行だけが見える`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        val visibleFromA = PostgresTestDatabase.inTenantTransaction(a.tenantId) { session ->
            session.select(TENANTS.ID).from(TENANTS).fetch(TENANTS.ID)
        }

        assertEquals(listOf(a.tenantId.value), visibleFromA)
        assertEquals(2, owner.fetchCount(TENANTS)) // オーナーからは両方見える(テストの前提)
        assertTrue(b.tenantId.value !in visibleFromA)
    }

    @Test
    fun `housework_app は tenants に INSERT も UPDATE も DELETE もできない(自分の家族の行でも)`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")

        val insert = assertThrows<DataAccessException> {
            PostgresTestDatabase.inTenantTransaction(a.tenantId) { session ->
                session.insertInto(TENANTS)
                    .set(TENANTS.ID, UUID.randomUUID())
                    .set(TENANTS.FAMILY_NAME, "侵入家")
                    .set(TENANTS.EMAIL, "intruder@example.com")
                    .execute()
            }
        }
        assertTrue(isRejected(insert, "permission denied")) { "INSERT が権限で拒否されていない: ${insert.message}" }

        val update = assertThrows<DataAccessException> {
            PostgresTestDatabase.inTenantTransaction(a.tenantId) { session ->
                session.update(TENANTS).set(TENANTS.FAMILY_NAME, "書き換え").where(TENANTS.ID.eq(a.tenantId.value)).execute()
            }
        }
        assertTrue(isRejected(update, "permission denied")) { "UPDATE が権限で拒否されていない: ${update.message}" }

        val delete = assertThrows<DataAccessException> {
            PostgresTestDatabase.inTenantTransaction(a.tenantId) { session ->
                session.deleteFrom(TENANTS).where(TENANTS.ID.eq(a.tenantId.value)).execute()
            }
        }
        assertTrue(isRejected(delete, "permission denied")) { "DELETE が権限で拒否されていない: ${delete.message}" }

        // 何も変わっていない
        assertEquals(1, owner.fetchCount(TENANTS))
        assertEquals("山田家", owner.select(TENANTS.FAMILY_NAME).from(TENANTS).fetchOne(TENANTS.FAMILY_NAME))
    }

    @Test
    fun `completed_domain_events は他の家族の行が見えず、他の家族の tenant_id では書き込めない`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")
        val repository = CompletedDomainEventRepositoryImpl()
        val eventOfA = UUID.randomUUID()
        PostgresTestDatabase.inTenantTransaction(a.tenantId) { repository.save(eventOfA, "TaskDefinitionDeleted", a.tenantId, it) }

        val fromB = PostgresTestDatabase.inTenantTransaction(b.tenantId) { session ->
            session.fetchCount(COMPLETED_DOMAIN_EVENTS) to repository.exists(eventOfA, session)
        }
        assertEquals(0 to false, fromB)

        // B のトランザクションで A の tenant_id を持つ行は書けない(RLS の WITH CHECK)
        val write = assertThrows<DataAccessException> {
            PostgresTestDatabase.inTenantTransaction(b.tenantId) { repository.save(UUID.randomUUID(), "TaskDefinitionDeleted", a.tenantId, it) }
        }
        assertTrue(isRejected(write, "row-level security")) { "RLS で拒否されていない: ${write.message}" }
        assertEquals(listOf(a.tenantId.value), owner.select(COMPLETED_DOMAIN_EVENTS.TENANT_ID).from(COMPLETED_DOMAIN_EVENTS).fetch(COMPLETED_DOMAIN_EVENTS.TENANT_ID))
    }

    @Test
    fun `テナント未設定の housework_app では tenants・outbox・completed_domain_events の読み取りがエラーになる(fail-closed)`() {
        TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), "山田家", "太郎", "taro@example.com")

        for (table in listOf(TENANTS, OUTBOX, COMPLETED_DOMAIN_EVENTS)) {
            val error = assertThrows<DataAccessException>("${table.name} が 0 件で返ってしまった") {
                PostgresTestDatabase.inAppTransactionWithoutTenant { it.fetchCount(table) }
            }
            // 新しい接続では「設定が無い」、使い回した接続では「uuid に変換できない」になる(#41)
            assertTrue(isRejected(error, "app.current_tenant_id", "invalid input syntax for type uuid")) {
                "${table.name}: fail-closed の原因が想定と違う: ${error.message}"
            }
        }
    }
}
