package com.task.isolation

import com.task.support.PostgresTestDatabase
import com.task.support.apiTest
import io.ktor.http.HttpStatusCode
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** タスク生成 API のテナント分離(#66) */
class TaskGenerationApiIsolationTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    @Test
    fun `A のトークンでの日次生成は A の定義の実行だけを作り、B の定義には実行が増えない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val aDef = createDailyFamilyTask(a, "Aの毎日タスク")
        val bDef = createDailyFamilyTask(b, "Bの毎日タスク")
        // 定義作成時に今日の実行が 1 件ずつ自動生成される
        val bBefore = executionIdsOfDefinition(bDef)
        assertEquals(1, bBefore.size)

        // 今日分(冪等なので追加は 0 件のはずだが、B の実行 ID は絶対に返らない)
        val today = postJson(a, "/api/task-generations/daily")
        assertEquals(HttpStatusCode.OK, today.status)
        val todayIds = today.bodyJson().jsonObject["taskExecutionIds"]!!.jsonArray.map { it.jsonPrimitive.content }
        assertTrue(todayIds.none { it in bBefore }) { "B の実行が返った: $todayIds" }

        // 未来日を指定すると A の定義の分だけ新規生成される
        val tomorrow = todayJst().plusDays(1)
        val res = postJson(a, "/api/task-generations/daily/$tomorrow")
        assertEquals(HttpStatusCode.OK, res.status)
        val ids = res.bodyJson().jsonObject["taskExecutionIds"]!!.jsonArray.map { it.jsonPrimitive.content }
        assertEquals(1, ids.size)
        assertEquals(1, res.bodyJson().jsonObject["generatedCount"]!!.jsonPrimitive.content.toInt())
        assertTrue(executionIdsOfDefinition(aDef).containsAll(ids)) { "生成された実行が A の定義のものではない" }

        // B の定義の実行は増えていない(オーナー接続で確認)
        assertEquals(bBefore.toSet(), executionIdsOfDefinition(bDef).toSet())
        assertEquals(2, executionIdsOfDefinition(aDef).size)
    }
}
