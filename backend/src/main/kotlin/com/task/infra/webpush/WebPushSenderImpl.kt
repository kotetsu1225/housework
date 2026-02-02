package com.task.infra.webpush

import com.google.inject.Inject
import nl.martijndwars.webpush.Notification
import nl.martijndwars.webpush.PushService
import org.slf4j.LoggerFactory
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Security
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json


class WebPushSenderImpl @Inject constructor(
    private val vapidConfig: VapidConfig
): WebPushSender {
    private val logger = LoggerFactory.getLogger(WebPushSenderImpl::class.java)
    private val pushService: PushService

    init {

        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(BouncyCastleProvider())
        }

        pushService = PushService(
            vapidConfig.publicKey,
            vapidConfig.privateKey,
            vapidConfig.subject
        )
    }

    override fun sendWebPushToMember(input: WebPushSender.SendWebPushInput): WebPushSender.SendResult{
        return try {
            val payload = buildPayload(input.title, input.body)

            val notification = Notification(
                input.pushSubscription.endpoint,
                input.pushSubscription.p256dhKey,
                input.pushSubscription.authKey,
                payload.toByteArray()
            )
            val response = pushService.send(notification)
            val statusCode = response.statusLine.statusCode

            when (statusCode) {
                201 -> {
                    logger.debug("Push送信成功: ${input.pushSubscription.endpoint}")
                    WebPushSender.SendResult.Success
                }
                410 -> {
                    // 購読が期限切れ or ユーザー許可取り消し
                    logger.info("購読が無効化 (410 Gone): ${input.pushSubscription.endpoint}")
                    WebPushSender.SendResult.SubscriptionExpired
                }
                else -> {
                    logger.warn("Push送信失敗 ($statusCode): ${input.pushSubscription.endpoint}")
                    WebPushSender.SendResult.Failed(statusCode, response.statusLine.reasonPhrase)
                }
            }
        } catch (e: Exception) {
            logger.error("Push送信中に例外発生: ${input.pushSubscription.endpoint}", e)
            WebPushSender.SendResult.Failed(-1, e.message ?: "Unknown error")
        }

    }

    private fun buildPayload(title: String, body: String): String {
        return Json.encodeToString(WebPushSender.WebPushPayload(title = title, body = body))
    }
}