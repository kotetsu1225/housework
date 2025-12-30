package com.task.infra.mail

import com.google.inject.Inject
import com.task.domain.mail.Mail
import com.task.domain.mail.MailSender
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory

/**
 * SendGrid Web API (v3) を使ったメール送信
 *
 * - SMTPがブロックされるPaaS環境でも、通常443で送れるため到達性が高い
 * - 失敗時は例外を投げ、呼び出し元（タスク作成）も失敗させる方針に合わせる
 */
class SendGridMailSender @Inject constructor(
    private val config: SendGridConfig,
) : MailSender {

    private val logger = LoggerFactory.getLogger(this::class.java)

    private val client: HttpClient = HttpClient(CIO) {
        install(HttpTimeout) {
            requestTimeoutMillis = 10_000
            connectTimeoutMillis = 10_000
            socketTimeoutMillis = 10_000
        }
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                    encodeDefaults = true
                }
            )
        }
    }

    override fun send(mail: Mail) {
        // MailSenderインターフェースが同期なので、最小限のrunBlockingで合わせる
        kotlinx.coroutines.runBlocking {
            val req = SendGridMailSendRequest(
                personalizations = listOf(
                    SendGridPersonalization(
                        to = listOf(SendGridEmailAddress(email = mail.to.value))
                    )
                ),
                from = SendGridEmailAddress(
                    email = config.fromAddress,
                    name = config.fromName
                ),
                subject = mail.subject,
                content = listOf(
                    SendGridContent(
                        type = "text/plain",
                        value = mail.body
                    )
                )
            )

            val response = client.post("https://api.sendgrid.com/v3/mail/send") {
                header(HttpHeaders.Authorization, "Bearer ${config.apiKey}")
                header(HttpHeaders.ContentType, ContentType.Application.Json)
                setBody(req)
            }

            if (response.status.isSuccess()) {
                logger.info("SendGrid送信成功: to={}, subject={}", mail.to.value, mail.subject)
                return@runBlocking
            }

            val body = response.bodyAsText()
            logger.error(
                "SendGrid送信失敗: status={}, to={}, subject={}, body={}",
                response.status.value,
                mail.to.value,
                mail.subject,
                body
            )
            throw IllegalStateException("SendGrid send failed: ${response.status.value}")
        }
    }
}

data class SendGridConfig(
    val apiKey: String,
    val fromAddress: String,
    val fromName: String = "Housework App",
)

@Serializable
private data class SendGridMailSendRequest(
    val personalizations: List<SendGridPersonalization>,
    val from: SendGridEmailAddress,
    val subject: String,
    val content: List<SendGridContent>,
)

@Serializable
private data class SendGridPersonalization(
    val to: List<SendGridEmailAddress>,
)

@Serializable
private data class SendGridEmailAddress(
    val email: String,
    val name: String? = null,
)

@Serializable
private data class SendGridContent(
    val type: String,
    val value: String,
)


