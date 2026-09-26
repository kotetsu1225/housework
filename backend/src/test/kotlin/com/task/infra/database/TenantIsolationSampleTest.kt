package com.task.infra.database

import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import org.jooq.exception.DataAccessException
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * issue #41のサンプルテスト。
 *
 * [PostgresTestDatabase] / [TestFixtures] を使って、実PostgreSQL + RLS + 2ロールで
 * テナント分離が機能することを確認する最小限のテスト。
 * 網羅的な隔離テストはissue #66で扱う。
 *
 * 実行にはDockerが必要。
 */
class TenantIsolationSampleTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    @Test
    fun `tenant Aのトランザクションではtenant Aのmembersだけが見える`() {
        val ownerDsl = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(ownerDsl, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(ownerDsl, "鈴木家", "次郎", "jiro@example.com")

        val rows = PostgresTestDatabase.inTenantTransaction(tenantA.tenantId) { dsl ->
            dsl.selectFrom(MEMBERS).fetch()
        }

        assertEquals(1, rows.size)
        assertEquals(tenantA.memberId.value, rows[0].id)
        assertTrue(rows.none { it.id == tenantB.memberId.value })
    }

    @Test
    fun `tenant Aのトランザクションでtenant Bのtenant_idを持つmembersをINSERTしようとすると例外になる`() {
        val ownerDsl = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(ownerDsl, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(ownerDsl, "鈴木家", "次郎", "jiro@example.com")

        val exception = assertThrows(DataAccessException::class.java) {
            PostgresTestDatabase.inTenantTransaction(tenantA.tenantId) { dsl ->
                dsl.insertInto(MEMBERS)
                    .set(MEMBERS.ID, UUID.randomUUID())
                    .set(MEMBERS.NAME, "不正メンバー")
                    .set(MEMBERS.ROLE, "MOTHER")
                    .set(MEMBERS.PASSWORD_HASH, "dummy-password-hash")
                    .set(MEMBERS.EMAIL, "invalid-${UUID.randomUUID()}@example.com")
                    .set(MEMBERS.TENANT_ID, tenantB.tenantId.value)
                    .execute()
            }
        }
        // 別の理由(構文エラーなど)の例外で通ってしまわないよう、RLS の WITH CHECK 違反であることまで確かめる
        assertTrue(exception.message!!.contains("row-level security policy")) { exception.message }
    }

    @Test
    fun `tenantを設定せずにapp接続でmembersを読むと例外になる(fail-closed)`() {
        val ownerDsl = PostgresTestDatabase.ownerDsl()
        TestFixtures.createTenantWithMember(ownerDsl, "山田家", "太郎", "taro@example.com")

        val exception = assertThrows(DataAccessException::class.java) {
            PostgresTestDatabase.inAppTransactionWithoutTenant { dsl ->
                dsl.selectFrom(MEMBERS).fetch()
            }
        }
        // ポリシーの current_setting('app.current_tenant_id')::uuid で失敗していることまで確かめる。
        // 新しい接続では「設定が存在しない」エラー、以前 set_config(..., true) したことのある接続
        // (プールの使い回し)では、設定が空文字として残るため「uuid に変換できない」エラーになる。
        // どちらも fail-closed(行が返らずエラーになる)。
        val message = exception.message!!
        assertTrue(
            message.contains("unrecognized configuration parameter \"app.current_tenant_id\"") ||
                message.contains("invalid input syntax for type uuid: \"\"")
        ) { message }
    }

    @Test
    fun `オーナー接続ではtenant Aとtenant Bの両方のmembersが見える`() {
        val ownerDsl = PostgresTestDatabase.ownerDsl()
        TestFixtures.createTenantWithMember(ownerDsl, "山田家", "太郎", "taro@example.com")
        TestFixtures.createTenantWithMember(ownerDsl, "鈴木家", "次郎", "jiro@example.com")

        val rows = ownerDsl.selectFrom(MEMBERS).fetch()

        assertEquals(2, rows.size)
    }
}
