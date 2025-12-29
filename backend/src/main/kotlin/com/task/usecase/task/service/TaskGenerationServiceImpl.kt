package com.task.usecase.task.service

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.AppTimeZone
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.task.service.TaskGenerationService
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import org.jooq.DSLContext
import java.time.LocalDate

@Singleton
class TaskGenerationServiceImpl @Inject constructor(
    private val taskDefinitionRepository: TaskDefinitionRepository,
    private val taskExecutionRepository: TaskExecutionRepository,
    private val domainEventDispatcher: DomainEventDispatcher,
) : TaskGenerationService {
    override fun generateDailyTaskExecution(today: LocalDate, session: DSLContext): List<TaskExecution.NotStarted> {
        val activeRecurringTaskDefinitions = taskDefinitionRepository.findAllRecurringActive(session)

        return activeRecurringTaskDefinitions.filter { it.schedule.isShouldCarryOut(today) }
            .mapNotNull { definition ->
                val existingExecution = taskExecutionRepository.findByDefinitionAndDate(
                    definition.id,
                    today,
                    session
                )

                if (existingExecution != null) {
                    return@mapNotNull null
                }

                // StateChange<NotStarted> を受け取る
                val stateChange = TaskExecution.create(
                    taskDefinition = definition,
                    scheduledDate = today.atStartOfDay(AppTimeZone.ZONE).toInstant()
                )

                taskExecutionRepository.create(stateChange.newState, session)
                domainEventDispatcher.dispatchAll(listOf(stateChange.event), session)

                stateChange.newState
            }
    }
}
