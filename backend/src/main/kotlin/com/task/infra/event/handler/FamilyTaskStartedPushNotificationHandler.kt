package com.task.infra.event.handler

import com.google.inject.Inject
import com.task.domain.event.DomainEventHandler
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.event.TaskExecutionStarted
import com.task.infra.event.handler.support.FamilyTaskPushNotificationService
import com.task.infra.event.handler.support.FamilyTaskPushNotificationService.NotificationRequest
import org.jooq.DSLContext
import org.slf4j.LoggerFactory

class FamilyTaskStartedPushNotificationHandler @Inject constructor(
    private val notificationService: FamilyTaskPushNotificationService,
) : DomainEventHandler<TaskExecutionStarted> {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override val eventType: Class<TaskExecutionStarted> = TaskExecutionStarted::class.java

    override fun handle(event: TaskExecutionStarted, session: DSLContext) {
        if (event.taskScope != TaskScope.FAMILY) return

        try {
            notificationService.sendToOtherFamilyMembers(
                NotificationRequest(
                    assigneeMemberIds = event.assigneeMemberIds,
                    taskName = event.taskName,
                    actionVerb = "タスクを開始しました！"
                ),
                session
            )
        } catch (e: Exception) {
            logger.error("WebPush通知の送信に失敗しましたが、処理は継続します", e)
        }
    }
}
