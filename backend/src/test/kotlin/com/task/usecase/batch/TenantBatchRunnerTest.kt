package com.task.usecase.batch

import com.task.domain.tenant.TenantId
import com.task.domain.tenant.TenantStatus
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.infra.tenant.TenantRepositoryImpl
import com.task.support.PostgresTestDatabase
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.OffsetDateTime

/**
 * #56 の受け入れ条件を実 DB で確かめる。
 * - 1テナントの block が例外を投げても、残りのテナントは処理される(失敗の隔離)
 * - DELETED のテナントは block に渡されない
 * - Summary.toLogMessage() に taskName・成功/失敗数・失敗したテナントの ID が含まれる
 */
class TenantBatchRunnerTest {

    private val runner = TenantBatchRunner(
        DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource),
        TenantRepositoryImpl(),
    )

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    /**
     * オーナー接続で tenants に1行 INSERT する。
     * [createdAt] を明示的にずらすことで、findAllActiveIds の列挙順(created_at 昇順)を
     * テストから固定できるようにする。
     */
    private fun insertTenant(
        familyName: String,
        email: String,
        status: TenantStatus,
        createdAt: OffsetDateTime,
    ): TenantId {
        val tenantId = TenantId.generate()
        PostgresTestDatabase.ownerDsl()
            .insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, familyName)
            .set(TENANTS.EMAIL, email)
            .set(TENANTS.STATUS, status.name)
            .set(TENANTS.CREATED_AT, createdAt)
            .execute()
        return tenantId
    }

    @Test
    fun `1テナントのblockが例外を投げても残りのテナントは処理され成功失敗が集計される`() {
        val base = OffsetDateTime.now()
        val tenant1 = insertTenant("1番目家", "t1@example.com", TenantStatus.ACTIVE, base)
        val tenant2 = insertTenant("2番目家", "t2@example.com", TenantStatus.ACTIVE, base.plusSeconds(1))
        val tenant3 = insertTenant("3番目家", "t3@example.com", TenantStatus.ACTIVE, base.plusSeconds(2))

        val processed = mutableListOf<TenantId>()
        val summary = runner.forEachActiveTenant("テストタスク") { tenantId ->
            processed.add(tenantId)
            if (tenantId == tenant2) {
                throw IllegalStateException("2番目のテナントで意図的に失敗させる")
            }
            "ok"
        }

        // 2番目が例外を投げても、3番目まで処理が続くこと
        assertEquals(listOf(tenant1, tenant2, tenant3), processed)

        assertEquals(2, summary.successCount)
        assertEquals(1, summary.failureCount)
        assertTrue(summary.results.getValue(tenant1).isSuccess)
        assertTrue(summary.results.getValue(tenant2).isFailure)
        assertTrue(summary.results.getValue(tenant3).isSuccess)
        assertTrue(summary.results.getValue(tenant2).exceptionOrNull() is IllegalStateException)
    }

    @Test
    fun `DELETEDのテナントはblockに渡されない`() {
        val active = insertTenant("有効家", "active@example.com", TenantStatus.ACTIVE, OffsetDateTime.now())
        insertTenant("削除済み家", "deleted@example.com", TenantStatus.DELETED, OffsetDateTime.now().plusSeconds(1))

        val processed = mutableListOf<TenantId>()
        val summary = runner.forEachActiveTenant("テストタスク") { tenantId ->
            processed.add(tenantId)
        }

        assertEquals(listOf(active), processed)
        assertEquals(1, summary.successCount)
        assertEquals(0, summary.failureCount)
    }

    @Test
    fun `toLogMessageにtaskNameと成功失敗数と失敗テナントIDが含まれる`() {
        val base = OffsetDateTime.now()
        val tenant1 = insertTenant("1番目家", "t1@example.com", TenantStatus.ACTIVE, base)
        val tenant2 = insertTenant("2番目家", "t2@example.com", TenantStatus.ACTIVE, base.plusSeconds(1))
        val tenant3 = insertTenant("3番目家", "t3@example.com", TenantStatus.ACTIVE, base.plusSeconds(2))

        val summary = runner.forEachActiveTenant("テストタスク") { tenantId ->
            if (tenantId == tenant2) {
                throw IllegalStateException("失敗")
            }
        }

        val message = summary.toLogMessage()
        assertTrue(message.contains("テストタスク")) { message }
        assertTrue(message.contains("成功 2")) { message }
        assertTrue(message.contains("失敗 1")) { message }
        assertTrue(message.contains(tenant2.value.toString())) { message }
        assertFalse(message.contains(tenant1.value.toString())) { message }
        assertFalse(message.contains(tenant3.value.toString())) { message }
    }
}
