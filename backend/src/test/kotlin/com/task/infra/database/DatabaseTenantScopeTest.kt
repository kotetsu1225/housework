package com.task.infra.database

import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import org.jooq.exception.DataAccessException
import org.jooq.impl.DSL
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * #40 の受け入れ条件を実 DB で確かめる。
 * - `Database.withTransaction(tenantId)` の中では自テナントの行だけが見え、他テナントの行は書けない
 * - 同じプール接続を続けて別テナントで使っても、前のテナントの設定が残らない
 * - 互換パスと `DatabaseWithoutRLS` はオーナー接続(RLS バイパス)
 */
class DatabaseTenantScopeTest {

    private val database = Database(
        PostgresTestDatabase.ownerDataSource,
        PostgresTestDatabase.appDataSource,
    )
    private val databaseWithoutRLS = DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    @Test
    fun `withTransaction(tenantId) では自テナントのメンバーだけが見える`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        val idsSeenByA = database.withTransaction(a.tenantId) { session ->
            session.select(MEMBERS.ID).from(MEMBERS).fetch(MEMBERS.ID)
        }
        val idsSeenByB = database.withTransaction(b.tenantId) { session ->
            session.select(MEMBERS.ID).from(MEMBERS).fetch(MEMBERS.ID)
        }

        assertEquals(listOf(a.memberId.value), idsSeenByA)
        assertEquals(listOf(b.memberId.value), idsSeenByB)
    }

    @Test
    fun `withTransaction(tenantId) で他テナントの行は INSERT も UPDATE もできない`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        val insert = assertThrows(DataAccessException::class.java) {
            database.withTransaction(a.tenantId) { session ->
                session.insertInto(MEMBERS)
                    .set(MEMBERS.ID, UUID.randomUUID())
                    .set(MEMBERS.NAME, "不正メンバー")
                    .set(MEMBERS.ROLE, "MOTHER")
                    .set(MEMBERS.PASSWORD_HASH, "dummy-password-hash")
                    .set(MEMBERS.EMAIL, "intruder@example.com")
                    .set(MEMBERS.TENANT_ID, b.tenantId.value)
                    .execute()
            }
        }
        assertTrue(insert.message!!.contains("row-level security policy")) { insert.message }

        // B の行は A からは見えないので、UPDATE は 0 件になり、B の名前は変わらない
        val updated = database.withTransaction(a.tenantId) { session ->
            session.update(MEMBERS).set(MEMBERS.NAME, "書き換え").where(MEMBERS.ID.eq(b.memberId.value)).execute()
        }
        assertEquals(0, updated)
        val nameOfB = owner.select(MEMBERS.NAME).from(MEMBERS).where(MEMBERS.ID.eq(b.memberId.value)).fetchOne(MEMBERS.NAME)
        assertEquals("次郎", nameOfB)
    }

    @Test
    fun `同じ接続を続けて別テナントで使っても前のテナントの設定が残らない`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val a = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val b = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        // 接続が 1 本しかないプールを使い、2 回のトランザクションが必ず同じ接続を使うようにする
        PostgresTestDatabase.createAppDataSource(maximumPoolSize = 1).use { singleConnectionPool ->
            val db = Database(PostgresTestDatabase.ownerDataSource, singleConnectionPool)
            val backendPidOf = { session: org.jooq.DSLContext ->
                session.fetchValue("select pg_backend_pid()") as Int
            }

            val (pidInA, idsInA) = db.withTransaction(a.tenantId) { session ->
                backendPidOf(session) to session.select(MEMBERS.ID).from(MEMBERS).fetch(MEMBERS.ID)
            }
            val (pidInB, idsInB) = db.withTransaction(b.tenantId) { session ->
                backendPidOf(session) to session.select(MEMBERS.ID).from(MEMBERS).fetch(MEMBERS.ID)
            }

            assertEquals(pidInA, pidInB) // 本当に同じ接続だったことの確認
            assertEquals(listOf(a.memberId.value), idsInA)
            assertEquals(listOf(b.memberId.value), idsInB)

            // トランザクションの外では、同じ接続に tenant の値が残っていない(空文字に戻っている)
            singleConnectionPool.connection.use { connection ->
                val leftover = DSL.using(connection).fetchValue(
                    "select current_setting('app.current_tenant_id', true)"
                ) as String?
                assertTrue(leftover.isNullOrEmpty()) { "前のテナントの値が残っている: $leftover" }
            }
        }
    }

    @Suppress("DEPRECATION")
    @Test
    fun `互換パスの withTransaction(block) と withSession はオーナー接続で全テナントが見える`() {
        val owner = PostgresTestDatabase.ownerDsl()
        TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        val countInTransaction = database.withTransaction { session -> session.fetchCount(MEMBERS) }
        val countInSession = database.withSession { session -> session.fetchCount(MEMBERS) }

        assertEquals(2, countInTransaction)
        assertEquals(2, countInSession)
    }

    @Test
    fun `DatabaseWithoutRLS はオーナー接続で全テナントが見える`() {
        val owner = PostgresTestDatabase.ownerDsl()
        TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")

        assertEquals(2, databaseWithoutRLS.withTransaction { session -> session.fetchCount(MEMBERS) })
        assertEquals(2, databaseWithoutRLS.withSession { session -> session.fetchCount(MEMBERS) })
    }
}
