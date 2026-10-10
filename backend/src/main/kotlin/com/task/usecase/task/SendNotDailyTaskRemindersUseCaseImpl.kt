package com.task.usecase.task

import com.google.inject.Inject
import com.task.domain.AppTimeZone
import com.task.infra.database.Database
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.usecase.query.notifications.UpcomingNotDailyTaskQueryService
import com.task.usecase.task.SendNotDailyTaskRemindersUseCase.ExecutionResult
import org.slf4j.LoggerFactory
import java.time.LocalDate
import java.time.LocalTime

/**
 * 非毎日タスクのリマインダー通知を、1 テナント分送るUseCase実装(#59)
 *
 * フロー:
 * 1. 取得: テナントのトランザクションで、通知対象タスク(メンバーごと)と Push 購読を取得する
 * 2. 送信: トランザクションの外でメンバーごとに WebPush 通知を送る([TenantPushNotificationDelivery])
 * 3. 後処理: 期限切れ購読を別の短いトランザクションで無効化する
 */
class SendNotDailyTaskRemindersUseCaseImpl @Inject constructor(
    private val database: Database,
    private val upcomingNotDailyTaskQueryService: UpcomingNotDailyTaskQueryService,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val delivery: TenantPushNotificationDelivery,
) : SendNotDailyTaskRemindersUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(input: SendNotDailyTaskRemindersUseCase.Input): ExecutionResult {
        val now = input.now
        val windowStart = now.plusSeconds(55 * 60).atZone(AppTimeZone.ZONE)
        val windowEnd = now.plusSeconds(65 * 60).atZone(AppTimeZone.ZONE)

        val windowStartDate: LocalDate = windowStart.toLocalDate()
        val windowStartTime: LocalTime = windowStart.toLocalTime()
        val windowEndDate: LocalDate = windowEnd.toLocalDate()
        val windowEndTime: LocalTime = windowEnd.toLocalTime()

        // 1. 取得(tenant スコープ)
        val messages = database.withTransaction(input.tenantId) { session ->
            val targets = upcomingNotDailyTaskQueryService
                .fetchUpcomingNotDailyTasks(
                    session,
                    windowStartDate,
                    windowStartTime,
                    windowEndDate,
                    windowEndTime
                )
                .filter { it.taskNames.isNotEmpty() }

            if (targets.isEmpty()) {
                logger.debug("通知対象タスクなし: tenantId=${input.tenantId.value}")
                return@withTransaction emptyList()
            }

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
                    title = "まもなくタスクの時間です！",
                    body = target.taskNames.joinToString("\n") { "・${it.value}" },
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
