package com.task.isolation

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

/** ダッシュボード・完了タスク一覧 API のテナント分離(#66) */
class DashboardAndCompletedTasksApiIsolationTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    @Test
    fun `A のダッシュボードに B のタスクもメンバーも含まれない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        createOneTimeFamilyTask(b, "Bの秘密タスク")
        val bExec = listExecutionIds(b).single()
        val today = todayJst()

        // 対照: B のダッシュボードには B のタスクが出る
        val bRes = getAs(b, "/api/dashboard?date=$today")
        assertEquals(HttpStatusCode.OK, bRes.status)
        assertEquals(1, bRes.bodyJson().jsonObject["todayTasks"]!!.jsonArray.size) { bRes.bodyAsTextBlocking() }

        val res = getAs(a, "/api/dashboard?date=$today")
        assertEquals(HttpStatusCode.OK, res.status)
        val json = res.bodyJson().jsonObject
        assertEquals(0, json["todayTasks"]!!.jsonArray.size) { res.bodyAsTextBlocking() }
        assertEquals(
            listOf(a.memberId),
            json["memberSummaries"]!!.jsonArray.map { it.jsonObject["memberId"]!!.jsonPrimitive.content },
        )
        val body = res.bodyAsText()
        assertFalse(b.memberId in body) { body }
        assertFalse(bExec in body) { body }
        assertFalse("Bの秘密タスク" in body) { body }
        assertFalse("次郎" in body) { body }
    }

    @Test
    fun `B が完了したタスクは、B のメンバー ID を指定しても A の完了タスク一覧に出ない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        createOneTimeFamilyTask(b, "Bの秘密タスク")
        val bExec = listExecutionIds(b).single()
        assertEquals(HttpStatusCode.OK, postJson(b, "/api/task-executions/$bExec/start", """{"memberIds":["${b.memberId}"]}""").status)
        assertEquals(HttpStatusCode.OK, postJson(b, "/api/task-executions/$bExec/complete").status)

        // 対照: B 自身には完了タスクが 1 件見える
        val bRes = getAs(b, "/api/completed-tasks")
        assertEquals(1, bRes.bodyJson().jsonObject["completedTasks"]!!.jsonArray.size) { bRes.bodyAsTextBlocking() }

        for (query in listOf("", "?memberIds=${b.memberId}", "?memberIds=${b.memberId},${a.memberId}&date=${todayJst()}")) {
            val res = getAs(a, "/api/completed-tasks$query")
            assertEquals(HttpStatusCode.OK, res.status) { query }
            assertEquals(0, res.bodyJson().jsonObject["completedTasks"]!!.jsonArray.size) { "$query: ${res.bodyAsTextBlocking()}" }
            val body = res.bodyAsText()
            assertFalse(bExec in body) { body }
            assertFalse("Bの秘密タスク" in body) { body }
            assertFalse(b.memberId in body) { body }
        }
    }
}
