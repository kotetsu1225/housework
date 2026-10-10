package com.task.support

import com.auth0.jwt.JWT
import com.google.inject.AbstractModule
import com.google.inject.util.Modules
import com.task.AppModule
import com.task.configureApiRoutes
import com.task.configureSerialization
import com.task.configureStatusPages
import com.task.domain.mail.Mail
import com.task.domain.mail.MailSender
import com.task.infra.database.Database
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.security.JwtConfig
import com.task.infra.webpush.WebPushSender
import com.task.presentation.GuicePlugin
import com.task.presentation.configureJwtAuth
import com.task.presentation.guiceInjectorKey
import io.ktor.client.HttpClient
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.patch
import io.ktor.client.request.delete
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.resources.Resources
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 本物のルート・StatusPages・JWT 認証・Guice の DI(AppModule)を、テスト用 DB(Testcontainers の PostgreSQL、
 * RLS あり)で動かす API テストの土台(#66)。
 *
 * - `AppModule` を `Modules.override` で上書きし、`Database` / `DatabaseWithoutRLS` をテスト用 DB に、
 *   `WebPushSender` / `MailSender` を記録するだけのフェイクに差し替える(外部通信はしない)
 * - スケジューラ・Pub/Sub・CORS は起動しない(`Application.module()` は呼ばない)
 * - `environment { config = MapApplicationConfig() }` で、src/main/resources の application.conf による
 *   本物の module 起動を防ぐ(#42 で判明した罠)
 *
 * 使い方:
 * ```
 * @Test
 * fun example() = apiTest {
 *     val a = signUp("山田家", "太郎", "taro@example.com")
 *     val res = getAs(a, "/api/member")
 *     assertEquals(HttpStatusCode.OK, res.status)
 * }
 * ```
 * データはテストごとに消えないので、テストクラスの @AfterEach で `PostgresTestDatabase.truncateAll()` を呼ぶこと。
 */
fun apiTest(block: suspend ApiTestContext.() -> Unit) {
    val fakes = ApiTestFakes()
    testApplication {
        environment { config = MapApplicationConfig() }
        application { apiTestModule(fakes) }
        ApiTestContext(this, client, fakes).block()
    }
}

/** テスト用の Application 設定(本番の module() からスケジューラ・Pub/Sub・CORS を除き、DI を差し替えたもの) */
private fun Application.apiTestModule(fakes: ApiTestFakes) {
    install(GuicePlugin) {
        modules = listOf(
            Modules.override(AppModule()).with(object : AbstractModule() {
                override fun configure() {
                    bind(Database::class.java).toInstance(Database(PostgresTestDatabase.appDataSource))
                    bind(DatabaseWithoutRLS::class.java)
                        .toInstance(DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource))
                    bind(WebPushSender::class.java).toInstance(fakes.webPush)
                    bind(MailSender::class.java).toInstance(fakes.mail)
                }
            })
        )
    }
    install(Resources)
    configureSerialization()
    configureStatusPages()
    configureJwtAuth(attributes[guiceInjectorKey].getInstance(JwtConfig::class.java))
    configureApiRoutes()
}

/** API テストで記録するフェイク */
class ApiTestFakes {
    val webPush = RecordingWebPushSender()
    val mail = RecordingMailSender()
}

class RecordingWebPushSender : WebPushSender {
    val sent = CopyOnWriteArrayList<WebPushSender.SendWebPushInput>()
    override fun sendWebPushToMember(input: WebPushSender.SendWebPushInput): WebPushSender.SendResult {
        sent.add(input)
        return WebPushSender.SendResult.Success
    }
}

class RecordingMailSender : MailSender {
    val sent = CopyOnWriteArrayList<Mail>()
    override fun send(mail: Mail) {
        sent.add(mail)
    }
}

/** サインアップした家族の最初のメンバー。token は JWT、memberId / tenantId は JWT のクレームから取る */
data class SignedUpMember(val token: String, val memberId: String, val tenantId: String, val email: String)

class ApiTestContext(
    val builder: ApplicationTestBuilder,
    val client: HttpClient,
    val fakes: ApiTestFakes,
) {
    val json = Json { ignoreUnknownKeys = true }

    /** `POST /api/auth/register`(家族の作成)。201/200 以外なら失敗させる */
    suspend fun signUp(familyName: String, name: String, email: String, password: String = "password123"): SignedUpMember {
        val res = postJson(
            null, "/api/auth/register",
            """{"familyName":"$familyName","name":"$name","email":"$email","familyRole":"FATHER","password":"$password"}""",
        )
        check(res.status.value in 200..299) { "サインアップに失敗: ${res.status} ${res.bodyAsText()}" }
        val token = json.parseToJsonElement(res.bodyAsText()).jsonObject["token"]!!.jsonPrimitive.content
        val decoded = JWT.decode(token)
        return SignedUpMember(token, decoded.subject, decoded.getClaim("tenantId").asString(), email)
    }

    suspend fun getAs(member: SignedUpMember?, path: String): HttpResponse =
        client.get(path) { member?.let { bearerAuth(it.token) } }

    suspend fun postJson(member: SignedUpMember?, path: String, body: String = "{}"): HttpResponse =
        client.post(path) {
            member?.let { bearerAuth(it.token) }
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    suspend fun putJson(member: SignedUpMember?, path: String, body: String = "{}"): HttpResponse =
        client.put(path) {
            member?.let { bearerAuth(it.token) }
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    suspend fun patchJson(member: SignedUpMember?, path: String, body: String = "{}"): HttpResponse =
        client.patch(path) {
            member?.let { bearerAuth(it.token) }
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    suspend fun deleteAs(member: SignedUpMember?, path: String): HttpResponse =
        client.delete(path) { member?.let { bearerAuth(it.token) } }

    suspend fun HttpResponse.bodyJson(): JsonElement = json.parseToJsonElement(bodyAsText())
}
