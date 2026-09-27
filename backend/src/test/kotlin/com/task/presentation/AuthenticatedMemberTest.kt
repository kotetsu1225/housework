package com.task.presentation

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.task.infra.security.JwtConfig
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.util.Date
import java.util.UUID

/**
 * `call.authenticatedMember()` を、実際の JwtAuthPlugin の認証パイプラインを通した上で検証する。
 * `/me` はテスト専用の認証済みルートで、authenticatedMember() の結果をレスポンスに埋め込むだけ。
 */
class AuthenticatedMemberTest {

    private val config = JwtConfig(
        secret = "test-secret",
        issuer = "test-issuer",
        audience = "test-audience",
        realm = "test-realm",
        expiresInMs = 60_000L,
    )

    private fun createToken(
        subject: String? = UUID.randomUUID().toString(),
        tenantId: String? = UUID.randomUUID().toString(),
    ): String {
        var builder = JWT.create()
            .withAudience(config.audience)
            .withIssuer(config.issuer)
            .withExpiresAt(Date(System.currentTimeMillis() + 60_000L))
        if (subject != null) {
            builder = builder.withSubject(subject)
        }
        if (tenantId != null) {
            builder = builder.withClaim("tenantId", tenantId)
        }
        return builder.sign(Algorithm.HMAC256(config.secret))
    }

    private fun ApplicationTestBuilder.setupMeRoute() {
        // 【重要】空の設定を明示する。指定しないと testApplication は src/main/resources/application.conf を読み、
        // ktor.application.modules の本物の Application.module を起動して、既定の DB(localhost:5432)に
        // 接続し Flyway とスケジューラまで動かしてしまう。
        environment {
            config = MapApplicationConfig()
        }
        application {
            configureJwtAuth(config)
            routing {
                authenticate("jwt") {
                    get("/me") {
                        val authenticatedMember = call.authenticatedMember()
                        call.respondText(
                            "${authenticatedMember.memberId.value}|${authenticatedMember.tenantId.value}"
                        )
                    }
                }
            }
        }
    }

    @Test
    fun `正しいトークンなら200でmemberIdとtenantIdが取得できる`() = testApplication {
        setupMeRoute()

        val memberId = UUID.randomUUID()
        val tenantId = UUID.randomUUID()
        val token = createToken(subject = memberId.toString(), tenantId = tenantId.toString())

        val response = client.get("/me") {
            header(HttpHeaders.Authorization, "Bearer $token")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("$memberId|$tenantId", response.bodyAsText())
    }

    @Test
    fun `tenantIdクレームの無いトークンは401`() = testApplication {
        setupMeRoute()

        val token = createToken(tenantId = null)

        val response = client.get("/me") {
            header(HttpHeaders.Authorization, "Bearer $token")
        }

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `tenantIdがUUIDでないトークンは401`() = testApplication {
        setupMeRoute()

        val token = createToken(tenantId = "not-a-uuid")

        val response = client.get("/me") {
            header(HttpHeaders.Authorization, "Bearer $token")
        }

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `トークンが無ければ401`() = testApplication {
        setupMeRoute()

        val response = client.get("/me")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }
}
