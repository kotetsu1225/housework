package com.task.usecase.task

import com.google.inject.Inject
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.infra.webpush.WebPushSender
import com.task.usecase.query.notifications.TomorrowNotDailyTaskQueryService
import com.task.usecase.task.SendNotDailyTomorrowTaskNotificationsUseCase.ExecutionResult
import org.slf4j.LoggerFactory

/**
 * 明日実行すべき非毎日タスクの通知を送信するUseCase実装
 *
 * フロー:
 * 1. QueryServiceからメンバーごとの非Daily明日タスクを取得
 * 2. 既に実行が存在するタスクを除外（絞り込み）
 * 3. Push購読を取得し、メンバーごとにWebPush通知を送信
 */
class SendNotDailyTomorrowTaskNotificationsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val tomorrowNotDailyTaskQueryService: TomorrowNotDailyTaskQueryService,
    private val taskExecutionRepository: TaskExecutionRepository,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val webPushSender: WebPushSender,
) : SendNotDailyTomorrowTaskNotificationsUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(
        input: SendNotDailyTomorrowTaskNotificationsUseCase.Input
    ): ExecutionResult {
        val tomorrow = input.targetDate.plusDays(1)

        return database.withTransaction { session ->
            val tasksByMember = tomorrowNotDailyTaskQueryService
                .fetchNotDailyTasksByMember(session, tomorrow)

            val definitionIdsWithExecution = tasksByMember
                .flatMap { it.taskDefinitions }
                .map { it.id }
                .distinct()
                .filter { id ->
                    taskExecutionRepository.findByDefinitionAndDate(id, tomorrow, session) != null
                }
                .toSet()

            val notificationTasks = SendNotDailyTomorrowTaskNotificationsUseCase.NotificationTasksOutput(
                notificationsForMember = tasksByMember.map { memberTasks ->
                    SendNotDailyTomorrowTaskNotificationsUseCase.NotificationForMember(
                        memberId = memberTasks.memberId,
                        tomorrowTaskNames = memberTasks.taskDefinitions
                            .filter { it.id !in definitionIdsWithExecution }
                            .map { it.name }
                    )
                }.filter { it.tomorrowTaskNames.isNotEmpty() }
            )

            val memberIds = notificationTasks.notificationsForMember.map { it.memberId }
            val subscriptionsByMember = pushSubscriptionRepository
                .findActiveByMemberIds(memberIds, session)
                .associateBy { it.memberId }

            val failedResults = mutableListOf<String>()

            for (target in notificationTasks.notificationsForMember) {
                val subscription = subscriptionsByMember[target.memberId]
                if (subscription == null) {
                    logger.debug("購読なし: memberId=${target.memberId.value}")
                    continue
                }

                val body = target.tomorrowTaskNames
                    .joinToString("\n") { "・${it.value}" }

                val result = webPushSender.sendWebPushToMember(
                    WebPushSender.SendWebPushInput(
                        pushSubscription = subscription,
                        title = "明日のタスクを確認しておきましょう！",
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
