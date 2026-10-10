package com.task.isolation

import com.task.domain.AppTimeZone
import com.task.support.ApiTestContext
import com.task.support.SignedUpMember
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate
import java.util.UUID

/** アプリが「今日」とみなす日付(JST) */
fun todayJst(): LocalDate = LocalDate.now(AppTimeZone.ZONE)

private const val TIME_RANGE = """"scheduledTimeRange":{"startTime":"2030-01-01T00:00:00Z","endTime":"2030-01-01T01:00:00Z"}"""

/** 今日が期限の FAMILY 単発タスク定義を API で作る(作成時に今日の実行が自動生成される)。定義 ID を返す */
suspend fun ApiTestContext.createOneTimeFamilyTask(member: SignedUpMember, name: String): String {
    val res = postJson(
        member, "/api/task-definitions/create",
        """{"name":"$name","description":"説明",$TIME_RANGE,"scope":"FAMILY",""" +
            """"schedule":{"type":"OneTime","deadline":"${todayJst()}"},"point":10}""",
    )
    check(res.status == HttpStatusCode.Created) { "タスク定義の作成に失敗: ${res.status} ${res.bodyAsText()}" }
    return res.bodyJson().jsonObject["id"]!!.jsonPrimitive.content
}

/** 毎日(土日も含む)の FAMILY 定期タスク定義を API で作る。定義 ID を返す */
suspend fun ApiTestContext.createDailyFamilyTask(member: SignedUpMember, name: String): String {
    val res = postJson(
        member, "/api/task-definitions/create",
        """{"name":"$name","description":"説明",$TIME_RANGE,"scope":"FAMILY",""" +
            """"schedule":{"type":"Recurring","pattern":{"type":"Daily","skipWeekends":false},"startDate":"2020-01-01","endDate":null},"point":10}""",
    )
    check(res.status == HttpStatusCode.Created) { "タスク定義の作成に失敗: ${res.status} ${res.bodyAsText()}" }
    return res.bodyJson().jsonObject["id"]!!.jsonPrimitive.content
}

/** `GET /api/task-executions` で、そのメンバーから見える実行の ID 一覧を返す */
suspend fun ApiTestContext.listExecutionIds(member: SignedUpMember): List<String> {
    val res = getAs(member, "/api/task-executions?limit=100")
    check(res.status == HttpStatusCode.OK) { "実行一覧の取得に失敗: ${res.status} ${res.bodyAsText()}" }
    return res.bodyJson().jsonObject["taskExecutions"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content }
}

/** 定義 ID に紐づく実行 ID を、オーナー接続(RLS なし)で全部引く */
fun executionIdsOfDefinition(definitionId: String): List<String> =
    com.task.support.PostgresTestDatabase.ownerDsl()
        .select(com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS.ID)
        .from(com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS)
        .where(com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(UUID.fromString(definitionId)))
        .fetch { it.value1().toString() }

/** assert のメッセージ(非 suspend のラムダ)用に、レスポンス本文を同期的に読む */
fun io.ktor.client.statement.HttpResponse.bodyAsTextBlocking(): String =
    kotlinx.coroutines.runBlocking { bodyAsText() }
