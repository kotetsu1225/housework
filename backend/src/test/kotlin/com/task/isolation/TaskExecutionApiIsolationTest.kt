package com.task.isolation

import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import com.task.support.ApiTestContext
import com.task.support.PostgresTestDatabase
import com.task.support.SignedUpMember
import com.task.support.apiTest
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

/** タスク実行 API のテナント分離(#66) */
class TaskExecutionApiIsolationTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun exec(id: String) =
        PostgresTestDatabase.ownerDsl().selectFrom(TASK_EXECUTIONS).where(TASK_EXECUTIONS.ID.eq(UUID.fromString(id))).fetchOne()!!

    private fun participants(id: String): Set<String> =
        PostgresTestDatabase.ownerDsl()
            .select(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID).from(TASK_EXECUTION_PARTICIPANTS)
            .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(UUID.fromString(id)))
            .fetch { it.value1().toString() }.toSet()

    /** B の FAMILY 単発タスクを作り、自動生成された B の実行 ID を返す */
    private suspend fun ApiTestContext.bExecution(b: SignedUpMember): String {
        createOneTimeFamilyTask(b, "Bの秘密タスク")
        val ids = listExecutionIds(b)
        assertEquals(1, ids.size) { "B の実行が 1 件自動生成されるはず: $ids" }
        return ids.single()
    }

    private fun ApiTestContext.assertNoNotificationFor(b: SignedUpMember) {
        assertTrue(fakes.webPush.sent.none { it.pushSubscription.memberId.value.toString() == b.memberId }) { "B に Web Push が送られた" }
        assertTrue(fakes.mail.sent.none { it.to.value == b.email }) { "B にメールが送られた" }
    }

    @Test
    fun `A のトークンでは B のタスク実行が一覧に含まれない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bExec = bExecution(b)

        val res = getAs(a, "/api/task-executions")
        assertEquals(HttpStatusCode.OK, res.status)
        val body = res.bodyAsText()
        assertFalse(bExec in body) { body }
        assertFalse("Bの秘密タスク" in body) { body }
        assertTrue(listExecutionIds(a).isEmpty())

        // B のメンバー ID で絞り込んでも A には何も返らない
        val filtered = getAs(a, "/api/task-executions?assigneeMemberId=${b.memberId}")
        assertEquals(HttpStatusCode.OK, filtered.status)
        assertFalse(bExec in filtered.bodyAsText())
        assertNoNotificationFor(b)
    }

    @Test
    fun `A のトークンで B のタスク実行を ID 指定で取得すると 404 で情報が返らない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bExec = bExecution(b)

        val res = getAs(a, "/api/task-executions/$bExec")
        assertEquals(HttpStatusCode.NotFound, res.status)
        assertFalse("Bの秘密タスク" in res.bodyAsText())
        assertEquals(HttpStatusCode.OK, getAs(b, "/api/task-executions/$bExec").status) // 対照
    }

    @Test
    fun `A のトークンで B の未着手タスクを開始・キャンセル・担当変更しようとしても 400 で B の実行は変わらない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bExec = bExecution(b)
        val before = exec(bExec)
        assertEquals("NOT_STARTED", before.status)

        // 開始(担当者は自分 / B のメンバーの 2 パターン)
        for (assignee in listOf(a.memberId, b.memberId)) {
            val start = postJson(a, "/api/task-executions/$bExec/start", """{"memberIds":["$assignee"]}""")
            assertEquals(HttpStatusCode.BadRequest, start.status) { start.bodyAsTextBlocking() }
        }
        // キャンセル
        val cancel = postJson(a, "/api/task-executions/$bExec/cancel")
        assertEquals(HttpStatusCode.BadRequest, cancel.status) { cancel.bodyAsTextBlocking() }
        // 担当変更
        for (assignee in listOf(a.memberId, b.memberId)) {
            val assign = postJson(a, "/api/task-executions/$bExec/assign", """{"memberIds":["$assignee"]}""")
            assertEquals(HttpStatusCode.BadRequest, assign.status) { assign.bodyAsTextBlocking() }
        }

        val after = exec(bExec)
        assertEquals("NOT_STARTED", after.status)
        assertNull(after.startedAt)
        assertNull(after.completedAt)
        assertEquals(before.updatedAt, after.updatedAt)
        assertEquals(emptySet<String>(), participants(bExec))
        assertNoNotificationFor(b)
    }

    @Test
    fun `A のトークンで B の進行中タスクを完了・キャンセル・担当変更しようとしても 400 で B の実行は変わらない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bExec = bExecution(b)
        val started = postJson(b, "/api/task-executions/$bExec/start", """{"memberIds":["${b.memberId}"]}""")
        assertEquals(HttpStatusCode.OK, started.status) { started.bodyAsTextBlocking() }
        val before = exec(bExec)
        assertEquals("IN_PROGRESS", before.status)

        val complete = postJson(a, "/api/task-executions/$bExec/complete")
        assertEquals(HttpStatusCode.BadRequest, complete.status) { complete.bodyAsTextBlocking() }
        val cancel = postJson(a, "/api/task-executions/$bExec/cancel")
        assertEquals(HttpStatusCode.BadRequest, cancel.status) { cancel.bodyAsTextBlocking() }
        val assign = postJson(a, "/api/task-executions/$bExec/assign", """{"memberIds":["${a.memberId}"]}""")
        assertEquals(HttpStatusCode.BadRequest, assign.status) { assign.bodyAsTextBlocking() }

        val after = exec(bExec)
        assertEquals("IN_PROGRESS", after.status)
        assertNull(after.completedAt)
        assertEquals(before.updatedAt, after.updatedAt)
        assertEquals(setOf(b.memberId), participants(bExec))
        // 単発タスクの定義も論理削除されていない(完了の副作用が B のデータに及んでいない)
        assertEquals(HttpStatusCode.OK, getAs(b, "/api/task-definitions/${exec(bExec).taskDefinitionId}").status)
    }

    @Test
    fun `A 自身の実行に B のメンバーを担当者として開始・担当変更しようとすると 400 で担当者は増えない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        createOneTimeFamilyTask(a, "Aのタスク")
        val aExec = listExecutionIds(a).single()

        val start = postJson(a, "/api/task-executions/$aExec/start", """{"memberIds":["${b.memberId}"]}""")
        assertEquals(HttpStatusCode.BadRequest, start.status) { start.bodyAsTextBlocking() }
        val assign = postJson(a, "/api/task-executions/$aExec/assign", """{"memberIds":["${b.memberId}"]}""")
        assertEquals(HttpStatusCode.BadRequest, assign.status) { assign.bodyAsTextBlocking() }

        assertEquals("NOT_STARTED", exec(aExec).status)
        assertEquals(emptySet<String>(), participants(aExec))
        assertNoNotificationFor(b)
    }
}
