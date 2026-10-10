package com.task.isolation

import com.task.support.PostgresTestDatabase
import com.task.support.apiTest
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** API テストの土台(ApiTestApplication)が本物のルート・DI・テスト用 DB で動くことの確認 */
class ApiHarnessSmokeTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    @Test
    fun `サインアップしたトークンで自分の家族のメンバー一覧が取れ、他の家族のメンバーは含まれない`() = apiTest {
        val a = signUp("山田家", "太郎", "taro@example.com")
        val b = signUp("鈴木家", "次郎", "jiro@example.com")

        val res = getAs(a, "/api/member")
        assertEquals(HttpStatusCode.OK, res.status)
        val body = res.bodyAsText()
        assertTrue(a.memberId in body) { body }
        assertFalse(b.memberId in body) { body }
    }
}
