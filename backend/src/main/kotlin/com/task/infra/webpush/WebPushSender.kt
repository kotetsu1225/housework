package com.task.infra.webpush

import com.task.infra.pushSubscription.PushSubscription
import kotlinx.serialization.Serializable


interface WebPushSender {

    data class SendWebPushInput(
        val pushSubscription: PushSubscription,
        val title: String,
        val body: String,
    )

    sealed class SendResult {
        data object Success : SendResult()
        /** 購読が無効化された（410 Gone）→ DBから削除すべき */
        data object SubscriptionExpired : SendResult()
        data class Failed(val statusCode: Int, val message: String) : SendResult()
    }

    @Serializable
    data class WebPushPayload(
        val title: String,
        val body: String,
        val icon: String = "/icons/icon-192x192.png"
    )

    fun sendWebPushToMember(input: SendWebPushInput): SendResult
}