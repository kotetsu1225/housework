package com.task.usecase.taskDefinition.handler

import com.google.inject.Inject
import com.task.domain.AppTimeZone
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.event.DomainEventHandler
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.event.TaskDefinitionCreated
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import org.jooq.DSLContext
import java.time.Instant
import java.time.LocalDate

class CreateTaskExecutionOnTaskDefinitionCreatedHandler @Inject constructor(
    private val taskExecutionRepository: TaskExecutionRepository,
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val domainEventDispatcher: DomainEventDispatcher,
) : DomainEventHandler<TaskDefinitionCreated> {
    override val eventType: Class<TaskDefinitionCreated> = TaskDefinitionCreated::class.java

    override fun handle(event: TaskDefinitionCreated, session: DSLContext) {
        val schedule = event.schedule
        val today = LocalDate.now(AppTimeZone.ZONE)
        val taskDefinition = taskDefinitionRepository.findById(event.taskDefinitionId, session)
            ?: throw IllegalArgumentException("TaskDefinition not found: ${event.taskDefinitionId}")

        when (schedule) {
            is TaskSchedule.OneTime -> {
                createExecution(
                    changeLocalDateToInstant(schedule.deadline),
                    taskDefinition,
                    session,
                )
            }

            is TaskSchedule.Recurring -> {
                if (schedule.isShouldCarryOut(today)) {
                    val existingExecution = taskExecutionRepository.findByDefinitionAndDate(
                        event.taskDefinitionId,
                        today,
                        session,
                    )
                    if (existingExecution == null) {
                        createExecution(
                            changeLocalDateToInstant(today),
                            taskDefinition,
                            session,
                        )
                    }
                }
            }
        }
    }

    private fun createExecution(scheduledDate: Instant, taskDefinition: TaskDefinition, session: DSLContext) {
        val stateChange = TaskExecution.create(
            taskDefinition = taskDefinition,
            scheduledDate = scheduledDate,
        )

        // 新しい状態を永続化
        taskExecutionRepository.create(stateChange.newState, session)
        domainEventDispatcher.dispatchAll(listOf(stateChange.event), session)
    }

    fun changeLocalDateToInstant(
        deadline: LocalDate,
    ): Instant {
        return deadline.atStartOfDay(AppTimeZone.ZONE).toInstant()
    }
}