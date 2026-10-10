package com.task.isolation

import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.support.PostgresTestDatabase
import com.task.support.apiTest
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import java.util.UUID

/** タスク定義 API のテナント分離(#66) */
class TaskDefinitionApiIsolationTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun row(id: String) =
        PostgresTestDatabase.ownerDsl().selectFrom(TASK_DEFINITIONS).where(TASK_DEFINITIONS.ID.eq(UUID.fromString(id))).fetchOne()!!

    @Test
    fun `A のトークンでは B のタスク定義が一覧に含まれない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bDef = createOneTimeFamilyTask(b, "Bの秘密タスク")
        val aDef = createOneTimeFamilyTask(a, "Aのタスク")

        val res = getAs(a, "/api/task-definitions")
        assertEquals(HttpStatusCode.OK, res.status)
        val json = res.bodyJson().jsonObject
        assertEquals(listOf(aDef), json["taskDefinitions"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content })
        assertEquals("1", json["total"]!!.jsonPrimitive.content)
        val body = res.bodyAsText()
        assertFalse(bDef in body) { body }
        assertFalse("Bの秘密タスク" in body) { body }
    }

    @Test
    fun `A のトークンで B のタスク定義を ID 指定で取得すると 404 で情報が返らない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bDef = createOneTimeFamilyTask(b, "Bの秘密タスク")

        val res = getAs(a, "/api/task-definitions/$bDef")
        assertEquals(HttpStatusCode.NotFound, res.status)
        assertFalse("Bの秘密タスク" in res.bodyAsText())

        // 対照: B 自身なら取れる
        assertEquals(HttpStatusCode.OK, getAs(b, "/api/task-definitions/$bDef").status)
    }

    @Test
    fun `A のトークンで B のタスク定義を更新しようとすると 400 で B の行は変わらない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bDef = createOneTimeFamilyTask(b, "Bの秘密タスク")
        val before = row(bDef)

        val res = postJson(a, "/api/task-definitions/$bDef/update", """{"name":"乗っ取り","point":999}""")
        assertEquals(HttpStatusCode.BadRequest, res.status) { res.bodyAsTextBlocking() }

        val after = row(bDef)
        assertEquals("Bの秘密タスク", after.name)
        assertEquals(before.point, after.point)
        assertEquals(before.version, after.version)
        assertEquals(before.updatedAt, after.updatedAt)
    }

    @Test
    fun `A のトークンで B のタスク定義を削除しようとすると 400 で B の行は削除されない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val bDef = createOneTimeFamilyTask(b, "Bの秘密タスク")

        val res = postJson(a, "/api/task-definitions/$bDef/delete")
        assertEquals(HttpStatusCode.BadRequest, res.status) { res.bodyAsTextBlocking() }

        assertEquals(false, row(bDef).isDeleted)
        // B からは引き続き見える
        assertEquals(HttpStatusCode.OK, getAs(b, "/api/task-definitions/$bDef").status)
    }

    @Test
    fun `A がタスク定義の担当者に B のメンバーを指定すると 400 で作成されない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val before = PostgresTestDatabase.ownerDsl().fetchCount(TASK_DEFINITIONS)

        val res = postJson(
            a, "/api/task-definitions/create",
            """{"name":"個人タスク","description":"d","scheduledTimeRange":{"startTime":"2030-01-01T00:00:00Z","endTime":"2030-01-01T01:00:00Z"},""" +
                """"scope":"PERSONAL","ownerMemberId":"${b.memberId}","schedule":{"type":"OneTime","deadline":"${todayJst()}"},"point":5}""",
        )
        assertEquals(HttpStatusCode.BadRequest, res.status) { res.bodyAsTextBlocking() }
        assertEquals(before, PostgresTestDatabase.ownerDsl().fetchCount(TASK_DEFINITIONS))
    }
}
