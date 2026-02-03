package com.task.infra.event.handler.support

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.Member
import com.task.domain.member.MemberId
import com.task.domain.member.MemberRepository
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.infra.webpush.WebPushSender
import org.jooq.DSLContext
import org.slf4j.LoggerFactory

@Singleton
class FamilyTaskPushNotificationService @Inject constructor(
    private val webPushSender: WebPushSender,
    private val memberRepository: MemberRepository,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
) {
    private val logger = LoggerFactory.getLogger(this::class.java)

    data class NotificationRequest(
        val assigneeMemberIds: List<MemberId>,
        val taskName: TaskDefinitionName,
        val actionVerb: String,
    )

    fun sendToOtherFamilyMembers(request: NotificationRequest, session: DSLContext) {
        val allMembers = memberRepository.findAll(session)
        val (assigneeMembers, otherMembers) = allMembers.partition { it.id in request.assigneeMemberIds }

        if (otherMembers.isEmpty()) {
            logger.debug("通知対象のメンバーがいません")
            return
        }

        val targetMemberIds = otherMembers.map { it.id }
        val subscriptionsByMember = pushSubscriptionRepository
            .findActiveByMemberIds(targetMemberIds, session)
            .associateBy { it.memberId }

        val title = buildNotificationTitle(assigneeMembers, request.actionVerb)
        val body = request.taskName.value

        val failedResults = mutableListOf<String>()

        targetMemberIds.forEach { memberId ->
            val subscription = subscriptionsByMember[memberId]
            if (subscription == null) {
                logger.debug("購読なし: memberId=${memberId.value}")
                return@forEach
            }

            val result = webPushSender.sendWebPushToMember(
                WebPushSender.SendWebPushInput(
                    pushSubscription = subscription,
                    title = title,
                    body = body
                )
            )

            when (result) {
                is WebPushSender.SendResult.Success -> {
                    logger.info("通知送信成功: memberId=${memberId.value}")
                }
                is WebPushSender.SendResult.SubscriptionExpired -> {
                    pushSubscriptionRepository.deactivate(subscription.id, session)
                    failedResults.add("memberId=${memberId.value}: 購読期限切れ")
                }
                is WebPushSender.SendResult.Failed -> {
                    failedResults.add("memberId=${memberId.value}: ${result.message}")
                }
            }
        }

        if (failedResults.isNotEmpty()) {
            logger.warn("一部の通知送信に失敗: ${failedResults.joinToString("; ")}")
        }
    }

    private fun buildNotificationTitle(assigneeMembers: List<Member>, actionVerb: String): String {
        require(assigneeMembers.isNotEmpty()) { "タスク操作には最低1人の担当者が必要" }

        return when (assigneeMembers.size) {
            1 -> "${assigneeMembers.first().name.value}さんが${actionVerb}"
            2, 3 -> {
                val names = assigneeMembers.joinToString("・") { it.name.value }
                "${names}さんが${actionVerb}"
            }
            else -> {
                val firstTwo = assigneeMembers.take(2).joinToString("・") { it.name.value }
                "${firstTwo}さん他${assigneeMembers.size - 2}名が${actionVerb}"
            }
        }
    }
}
