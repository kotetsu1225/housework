package com.task.usecase.task

import com.google.inject.Inject
import com.task.domain.member.MemberId
import com.task.domain.tenant.TenantId
import com.task.infra.database.Database
import com.task.infra.pushSubscription.PushSubscription
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.infra.webpush.WebPushSender
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * 通知バッチ(#58 #59 #60)の「送信」と「後処理」を受け持つ共通部品。
 *
 * 通知バッチはテナントごとに次の 3 段で動く(ADR #19 決定 2):
 * 1. 取得: 各 UseCase が `database.withTransaction(tenantId)` の中で通知対象と購読を取得し、トランザクションを閉じる
 * 2. 送信: [deliver] がトランザクションの**外**で Web Push を送る(外部 HTTP 通信の間 DB 接続を握らない)
 * 3. 後処理: 期限切れ(410 Gone)になった購読の無効化を、別の短い `withTransaction(tenantId)` で行う
 *
 * 1 件の送信が例外を投げても、残りの送信と期限切れの無効化は続ける(結果は失敗として返す)。
 */
class TenantPushNotificationDelivery @Inject constructor(
    private val database: Database,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val webPushSender: WebPushSender,
) {
    private val logger = LoggerFactory.getLogger(this::class.java)

    /** 1 メンバーへの 1 通。購読は取得段階で同じテナントのトランザクションから読んだもの */
    data class Message(
        val memberId: MemberId,
        val subscription: PushSubscription,
        val title: String,
        val body: String,
    )

    /**
     * [messages] をトランザクションの外で送り、期限切れの購読を [tenantId] のトランザクションで無効化する。
     *
     * @return 失敗の説明(「memberId=...: 理由」)。全件成功なら空
     */
    fun deliver(tenantId: TenantId, messages: List<Message>): List<String> {
        val failures = mutableListOf<String>()
        val expiredSubscriptionIds = mutableListOf<UUID>()

        for (message in messages) {
            val memberLabel = "memberId=${message.memberId.value}"
            val result = try {
                webPushSender.sendWebPushToMember(
                    WebPushSender.SendWebPushInput(
                        pushSubscription = message.subscription,
                        title = message.title,
                        body = message.body,
                    )
                )
            } catch (e: Exception) {
                logger.error("通知送信で例外: tenantId=${tenantId.value}, $memberLabel", e)
                failures.add("$memberLabel: ${e.message}")
                continue
            }

            when (result) {
                is WebPushSender.SendResult.Success -> logger.info("通知送信成功: tenantId=${tenantId.value}, $memberLabel")
                is WebPushSender.SendResult.SubscriptionExpired -> {
                    expiredSubscriptionIds.add(message.subscription.id)
                    failures.add("$memberLabel: 購読期限切れ")
                }
                is WebPushSender.SendResult.Failed -> failures.add("$memberLabel: ${result.message}")
            }
        }

        if (expiredSubscriptionIds.isNotEmpty()) {
            database.withTransaction(tenantId) { session ->
                expiredSubscriptionIds.forEach { pushSubscriptionRepository.deactivate(it, session) }
            }
        }

        return failures
    }
}
