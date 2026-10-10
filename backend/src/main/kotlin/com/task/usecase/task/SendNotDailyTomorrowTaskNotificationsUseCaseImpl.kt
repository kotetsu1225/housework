package com.task.usecase.task

import com.google.inject.Inject
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database
import com.task.infra.pushSubscription.PushSubscriptionRepository
import com.task.usecase.query.notifications.TomorrowNotDailyTaskQueryService
import com.task.usecase.task.SendNotDailyTomorrowTaskNotificationsUseCase.ExecutionResult
import org.slf4j.LoggerFactory

/**
 * 明日実行すべき非毎日タスクの通知を、1 テナント分送るUseCase実装(#60)
 *
 * フロー:
 * 1. 取得: テナントのトランザクションで、メンバーごとの非Daily明日タスクを取得し、
 *    既に実行が存在するタスクを除外して、Push 購読を取得する
 * 2. 送信: トランザクションの外でメンバーごとに WebPush 通知を送る([TenantPushNotificationDelivery])
 * 3. 後処理: 期限切れ購読を別の短いトランザクションで無効化する
 */
class SendNotDailyTomorrowTaskNotificationsUseCaseImpl @Inject constructor(
    private val database: Database,
    private val tomorrowNotDailyTaskQueryService: TomorrowNotDailyTaskQueryService,
    private val taskExecutionRepository: TaskExecutionRepository,
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val delivery: TenantPushNotificationDelivery,
) : SendNotDailyTomorrowTaskNotificationsUseCase {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun execute(
        input: SendNotDailyTomorrowTaskNotificationsUseCase.Input
    ): ExecutionResult {
        val tomorrow = input.targetDate.plusDays(1)

        // 1. 取得(tenant スコープ)
        val messages = database.withTransaction(input.tenantId) { session ->
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

            val targets = tasksByMember.map { memberTasks ->
                SendNotDailyTomorrowTaskNotificationsUseCase.NotificationForMember(
                    memberId = memberTasks.memberId,
                    tomorrowTaskNames = memberTasks.taskDefinitions
                        .filter { it.id !in definitionIdsWithExecution }
                        .map { it.name }
                )
            }.filter { it.tomorrowTaskNames.isNotEmpty() }

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
                    title = "明日のタスクを確認しておきましょう！",
                    body = target.tomorrowTaskNames.joinToString("\n") { "・${it.value}" },
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
