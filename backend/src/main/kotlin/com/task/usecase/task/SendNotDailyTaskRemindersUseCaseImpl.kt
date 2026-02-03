package com.task.usecase.task

import com.google.inject.Inject
import com.task.domain.AppTimeZone
import com.task.infra.database.Database
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.infra.webpush.WebPushSender
import com.task.usecase.query.notifications.UpcomingNotDailyTaskQueryService
import com.task.usecase.task.SendNotDailyTaskRemindersUseCase.ExecutionResult
import org.slf4j.LoggerFactory
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime

/**
 * 非毎日タスクのリマインダー通知を送信するUseCase実装
 *
 * フロー:
 * 1. QueryServiceから通知対象タスクをメンバーごとに取得
 * 2. Push購読を取得
 * 3. メンバーごとにWebPush通知を送信
 */
class SendNotDailyTaskRemindersUseCaseImpl @Inject constructor(
    private val database: Database,
    private val upcomingNotDailyTaskQueryService: UpcomingNotDailyTaskQueryService,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val webPushSender: WebPushSender,
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

        return database.withTransaction { session ->
            val notificationTargets = upcomingNotDailyTaskQueryService
                .fetchUpcomingNotDailyTasks(
                    session,
                    windowStartDate,
                    windowStartTime,
                    windowEndDate,
                    windowEndTime
                )
                .filter { it.taskNames.isNotEmpty() }

            if (notificationTargets.isEmpty()) {
                logger.debug("通知対象タスクなし")
                return@withTransaction ExecutionResult.Success
            }

            val memberIds = notificationTargets.map { it.memberId }
            val subscriptionsByMember = pushSubscriptionRepository
                .findActiveByMemberIds(memberIds, session)
                .associateBy { it.memberId }

            val failedResults = mutableListOf<String>()

            for (target in notificationTargets) {
                val subscription = subscriptionsByMember[target.memberId]
                if (subscription == null) {
                    logger.debug("購読なし: memberId=${target.memberId.value}")
                    continue
                }

                val body = target.taskNames
                    .joinToString("\n") { "・${it.value}" }

                val result = webPushSender.sendWebPushToMember(
                    WebPushSender.SendWebPushInput(
                        pushSubscription = subscription,
                        title = "まもなくタスクの時間です！",
                        body = body
                    )
                )

                when (result) {
                    is WebPushSender.SendResult.Success -> {
                        logger.info("リマインダー通知送信成功: memberId=${target.memberId.value}")
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
