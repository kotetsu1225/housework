package com.task.usecase.taskDefinition.handler

import com.google.inject.Inject
import com.task.domain.AppTimeZone
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.event.DomainEventHandler
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.event.TaskDefinitionCreated
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import org.jooq.DSLContext

class CreateTaskExecutionOnTaskDefinitionCreatedHandler @Inject constructor(
    private val taskExecutionRepository: TaskExecutionRepository,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val domainEventDispatcher: DomainEventDispatcher,
) : DomainEventHandler<TaskDefinitionCreated> {
    override val eventType: Class<TaskDefinitionCreated> = TaskDefinitionCreated::class.java

    override fun handle(event: TaskDefinitionCreated, session: DSLContext) {
        val schedule = event.schedule
        if (schedule !is TaskSchedule.OneTime) {
            return
        }

        // TaskDefinitionを取得（ファクトリメソッドに必要）
        val taskDefinition = taskDefinitionRepository.findById(event.taskDefinitionId, session)
            ?: throw IllegalArgumentException("TaskDefinition not found: ${event.taskDefinitionId}")

        val scheduledDate = schedule.deadline
            .atStartOfDay(AppTimeZone.ZONE)
            .toInstant()

        // ファクトリメソッドを使用してTaskExecutionを生成
        // これにより TaskExecutionCreated イベントも一緒に生成される
        val stateChange = TaskExecution.create(
            taskDefinition = taskDefinition,
            scheduledDate = scheduledDate,
        )

        // 新しい状態を永続化
        taskExecutionRepository.create(stateChange.newState, session)

        // TaskExecutionCreated イベントをディスパッチ
        // これにより EmailNotificationHandler が呼び出され、メール通知が送信される
        domainEventDispatcher.dispatchAll(listOf(stateChange.event), session)
    }
}