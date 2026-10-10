package com.task.isolation

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.support.PostgresTestDatabase
import com.task.support.apiTest
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.Date
import java.util.UUID

/** メンバー API のテナント分離(#66)。A の家族のトークンで B の家族のメンバーに触れないことを確認する */
class MemberApiIsolationTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    private fun memberRow(memberId: String) =
        PostgresTestDatabase.ownerDsl().selectFrom(MEMBERS).where(MEMBERS.ID.eq(UUID.fromString(memberId))).fetchOne()

    @Test
    fun `A のトークンでは B のメンバーが一覧に含まれない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")

        val res = getAs(a, "/api/member")
        assertEquals(HttpStatusCode.OK, res.status)
        val ids = res.bodyJson().jsonObject["members"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content }
        assertEquals(listOf(a.memberId), ids)
        val body = res.bodyAsText()
        assertFalse(b.memberId in body) { body }
        assertFalse(b.email in body) { body }
    }

    @Test
    fun `A のトークンで B のメンバーを ID 指定で取得すると 404 で情報が返らない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")

        val res = getAs(a, "/api/member/${b.memberId}")
        assertEquals(HttpStatusCode.NotFound, res.status)
        val body = res.bodyAsText()
        assertFalse(b.email in body) { body }
        assertFalse("次郎" in body) { body }

        // 対照: 自分の ID なら取れる
        assertEquals(HttpStatusCode.OK, getAs(a, "/api/member/${a.memberId}").status)
    }

    @Test
    fun `A のトークンで B のメンバーを更新しようとすると 400 で B の行は変わらない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val before = memberRow(b.memberId)!!

        val res = postJson(a, "/api/member/${b.memberId}/update", """{"name":"乗っ取り","familyRole":"SISTER"}""")
        assertEquals(HttpStatusCode.BadRequest, res.status) { res.bodyAsTextBlocking() }

        val after = memberRow(b.memberId)!!
        assertEquals("次郎", after.name)
        assertEquals(before.role, after.role)
        assertEquals(before.updatedAt, after.updatedAt)
        assertEquals(before.tenantId, after.tenantId)
    }

    @Test
    fun `別の家族に同じ名前のメンバーがいても、名前の重複にならずどちらの家族でも作れる`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "太郎", "b@example.com") // サインアップ時点で同名でも成功する

        // A の家族に、B の家族のメンバーと同名("太郎"は A にも既にいるので別名で確認)
        val bMember = postJson(b, "/api/member/create", """{"name":"花子","email":"b2@example.com","familyRole":"MOTHER","password":"password123"}""")
        assertEquals(HttpStatusCode.Created, bMember.status) { bMember.bodyAsTextBlocking() }
        val aMember = postJson(a, "/api/member/create", """{"name":"花子","email":"a2@example.com","familyRole":"MOTHER","password":"password123"}""")
        assertEquals(HttpStatusCode.Created, aMember.status) { aMember.bodyAsTextBlocking() }

        // 同じ家族の中では従来どおり重複は拒否される(対照)
        val dup = postJson(a, "/api/member/create", """{"name":"花子","email":"a3@example.com","familyRole":"MOTHER","password":"password123"}""")
        assertEquals(HttpStatusCode.BadRequest, dup.status) { dup.bodyAsTextBlocking() }

        // 各家族に自分の家族のメンバーだけが見える
        val aNames = getAs(a, "/api/member").bodyJson().jsonObject["members"]!!.jsonArray.map { it.jsonObject["name"]!!.jsonPrimitive.content }
        assertEquals(setOf("太郎", "花子"), aNames.toSet())
        assertEquals(2, aNames.size)
    }

    @Test
    fun `別の家族で使われているメールアドレスでメンバーを作ると 409 になり行は増えない`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        val b = signUp("鈴木家", "次郎", "b@example.com")
        val countBefore = PostgresTestDatabase.ownerDsl().fetchCount(MEMBERS)

        val res = postJson(a, "/api/member/create", """{"name":"三郎","email":"${b.email}","familyRole":"BROTHER","password":"password123"}""")
        assertEquals(HttpStatusCode.Conflict, res.status) { res.bodyAsTextBlocking() }

        assertEquals(countBefore, PostgresTestDatabase.ownerDsl().fetchCount(MEMBERS))
        // B のメンバーの所属は変わっていない
        assertEquals(b.tenantId, memberRow(b.memberId)!!.tenantId.toString())
    }

    @Test
    fun `tenantId クレームの無い JWT は 401 になり、同じ署名で tenantId を付ければ 200 になる`() = apiTest {
        val a = signUp("山田家", "太郎", "a@example.com")
        // src/main/resources/application.conf の開発用設定値
        val algorithm = Algorithm.HMAC256("your-256-bit-secret-key-for-development")
        fun token(withTenant: Boolean): String = JWT.create()
            .withIssuer("housework-app")
            .withAudience("housework-users")
            .withSubject(a.memberId)
            .withExpiresAt(Date(System.currentTimeMillis() + 60_000))
            .apply { if (withTenant) withClaim("tenantId", a.tenantId) }
            .sign(algorithm)

        val without = client.get("/api/member") { bearerAuth(token(false)) }
        assertEquals(HttpStatusCode.Unauthorized, without.status)

        val with = client.get("/api/member") { bearerAuth(token(true)) }
        assertEquals(HttpStatusCode.OK, with.status) { with.bodyAsTextBlocking() }
        assertTrue(a.memberId in with.bodyAsText())
    }
}
