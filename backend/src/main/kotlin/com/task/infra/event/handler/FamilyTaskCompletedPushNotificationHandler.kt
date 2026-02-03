package com.task.infra.event.handler

import com.google.inject.Inject
import com.task.domain.event.DomainEventHandler
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.event.TaskExecutionCompleted
import com.task.infra.event.handler.support.FamilyTaskPushNotificationService
import com.task.infra.event.handler.support.FamilyTaskPushNotificationService.NotificationRequest
import org.jooq.DSLContext
import org.slf4j.LoggerFactory

class FamilyTaskCompletedPushNotificationHandler @Inject constructor(
    private val notificationService: FamilyTaskPushNotificationService,
) : DomainEventHandler<TaskExecutionCompleted> {

    private val logger = LoggerFactory.getLogger(this::class.java)

    override val eventType: Class<TaskExecutionCompleted> = TaskExecutionCompleted::class.java

    override fun handle(event: TaskExecutionCompleted, session: DSLContext) {
        if (event.taskScope != TaskScope.FAMILY) return

        try {
            notificationService.sendToOtherFamilyMembers(
                NotificationRequest(
                    assigneeMemberIds = event.assigneeMemberIds,
                    taskName = event.taskName,
                    actionVerb = "タスクを完了しました！"
                ),
                session
            )
        } catch (e: Exception) {
            logger.error("WebPush通知の送信に失敗しましたが、処理は継続します", e)
        }
    }
}
