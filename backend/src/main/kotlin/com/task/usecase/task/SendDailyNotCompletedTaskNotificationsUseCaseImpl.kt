package com.task.usecase.task

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.usecase.query.notifications.NotificationTargetQueryService
import com.task.usecase.task.SendDailyNotCompletedTaskNotificationsUseCase.ExecutionResult
import org.slf4j.LoggerFactory

/**
 * 毎日タスクの未完了通知を、1 テナント分送るUseCase実装(#58)。
 *
 * 取得は [input] のテナントのトランザクション(RLS で自テナントに絞られる)で行い、
 * 送信と期限切れ購読の無効化は [TenantPushNotificationDelivery] がトランザクションの外 / 別トランザクションで行う。
 * 全テナントへの反復はスケジューラが TenantBatchRunner で行う。
 */
class SendDailyNotCompletedTaskNotificationsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val notificationTargetQueryService: NotificationTargetQueryService,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val delivery: TenantPushNotificationDelivery,
) : SendDailyNotCompletedTaskNotificationsUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(
        input: SendDailyNotCompletedTaskNotificationsUseCase.Input
    ): ExecutionResult {
        // 1. 取得(tenant スコープ)
        val messages = database.withTransaction(input.tenantId) { session ->
            val targets = notificationTargetQueryService
                .fetchNotCompletedDailyTasks(session, input.targetDate)
                .filter { it.notCompletedDailyTaskNames.isNotEmpty() }

            val subscriptionsByMember = pushSubscriptionRepository
                .findActiveByMemberIds(targets.map { it.memberId }, session)
                .associateBy { it.memberId }

            targets.mapNotNull { target ->
                val subscription = subscriptionsByMember[target.memberId]
                if (subscription == null) {
                    logger.debug("購読なし: memberId=${target.memberId.value}")
                    return@mapNotNull null
                }
                TenantPushNotificationDelivery.Message(
                    memberId = target.memberId,
                    subscription = subscription,
                    title = "未完了の毎日タスクが残っています!!",
                    body = target.notCompletedDailyTaskNames.joinToString("\n") { "・${it.value}" },
                )
            }
        }

        // 2. 送信(トランザクションの外)と 3. 期限切れ購読の無効化
        val failures = delivery.deliver(input.tenantId, messages)
        return if (failures.isEmpty()) {
            ExecutionResult.Success
        } else {
            ExecutionResult.Failed(status = "PARTIAL_FAILURE", message = failures.joinToString("; "))
        }
    }
}
