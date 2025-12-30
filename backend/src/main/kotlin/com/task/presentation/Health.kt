package com.task.presentation

import com.google.inject.ConfigurationException
import com.task.infra.mail.SmtpConfig
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.resources.get
import kotlinx.serialization.Serializable
import java.net.InetSocketAddress
import java.net.Socket

@Resource("api/health")
class Health {
    @Resource("/mail")
    class Mail(val parent: Health = Health())
}

@Serializable
data class MailHealthResponse(
    val enabled: Boolean,
    val ok: Boolean,
    val host: String? = null,
    val port: Int? = null,
    val connectTimeoutMs: Int,
    val message: String? = null,
)

/**
 * メール（SMTP）到達性チェック用エンドポイント
 *
 * - Railway等の本番環境で「Connect timed out」の原因を断定するために使用
 * - 認証（jwt）配下で呼ばれる想定
 */
fun Route.health() {
    get<Health.Mail> {
        // SmtpConfigは mail.provider=smtp の場合のみGuiceにbindされる
        val smtpConfig = try {
            call.instance<SmtpConfig>()
        } catch (e: ConfigurationException) {
            call.respond(
                HttpStatusCode.OK,
                MailHealthResponse(
                    enabled = false,
                    ok = true,
                    connectTimeoutMs = 0,
                    message = "mail.provider is not smtp (SMTP disabled)",
                )
            )
            return@get
        }

        val connectTimeoutMs = 5000
        val host = smtpConfig.host
        val port = smtpConfig.port

        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), connectTimeoutMs)
            }

            call.respond(
                HttpStatusCode.OK,
                MailHealthResponse(
                    enabled = true,
                    ok = true,
                    host = host,
                    port = port,
                    connectTimeoutMs = connectTimeoutMs,
                    message = "TCP connect ok",
                )
            )
        } catch (e: Exception) {
            call.respond(
                HttpStatusCode.OK,
                MailHealthResponse(
                    enabled = true,
                    ok = false,
                    host = host,
                    port = port,
                    connectTimeoutMs = connectTimeoutMs,
                    message = "${e::class.java.name}: ${e.message}",
                )
            )
        }
    }
}


