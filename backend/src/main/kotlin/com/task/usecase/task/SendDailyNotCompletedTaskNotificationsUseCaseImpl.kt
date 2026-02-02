package com.task.usecase.task

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.infra.webpush.WebPushSender
import com.task.usecase.query.notifications.NotificationTargetQueryService
import com.task.usecase.task.SendDailyNotCompletedTaskNotificationsUseCase.ExecutionResult
import org.slf4j.LoggerFactory

/**
 * 毎日タスクの未完了通知を生成するUseCase実装
 */
class SendDailyNotCompletedTaskNotificationsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val notificationTargetQueryService: NotificationTargetQueryService,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val webPushSender: WebPushSender,
) : SendDailyNotCompletedTaskNotificationsUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(
        input: SendDailyNotCompletedTaskNotificationsUseCase.Input
    ): ExecutionResult {
        return database.withTransaction { session ->

            val notificationTasks = SendDailyNotCompletedTaskNotificationsUseCase.NotificationTasksOutput(
                notificationsForMember = notificationTargetQueryService
                    .fetchNotCompletedDailyTasks(session, input.targetDate)
                    .filter { it.notCompletedDailyTaskNames.isNotEmpty() }
            )

            val memberIds =  notificationTasks.notificationsForMember.map { it.memberId }
            val subscriptionsByMember = pushSubscriptionRepository
                .findActiveByMemberIds(memberIds, session)
                .associateBy { it.memberId }

            val failedResults = mutableListOf<String>()

            for (target in  notificationTasks.notificationsForMember) {
                val subscription = subscriptionsByMember[target.memberId]
                if (subscription == null) {
                    logger.debug("購読なし: memberId=${target.memberId.value}")
                    continue
                }

                if (target.notCompletedDailyTaskNames.isEmpty()) {
                    logger.debug("未完了タスクなし: memberId=${target.memberId.value}")
                    continue
                }

                val body = target.notCompletedDailyTaskNames
                    .joinToString("\n") { "・${it.value}" }

                val result = webPushSender.sendWebPushToMember(
                    WebPushSender.SendWebPushInput(
                        pushSubscription = subscription,
                        title = "未完了の毎日タスクが残っています!!",
                        body = body
                    )
                )

                when (result) {
                    is WebPushSender.SendResult.Success -> {
                        logger.info("通知送信成功: memberId=${target.memberId.value}")
                    }
                    is WebPushSender.SendResult.SubscriptionExpired -> {
                        pushSubscriptionRepository.deactivate(subscription.id, session)
                        failedResults.add("memberId=${target.memberId.value}: 購読期限切れ")
                    }
                    is WebPushSender.SendResult.Failed -> {
                        failedResults.add("memberId=${target.memberId.value}: ${result.message}")
                    }
                }
            }

            if (failedResults.isEmpty()) {
                ExecutionResult.Success
            } else {
                ExecutionResult.Failed(
                    status = "PARTIAL_FAILURE",
                    message = failedResults.joinToString("; ")
                )
            }
        }
    }
}
