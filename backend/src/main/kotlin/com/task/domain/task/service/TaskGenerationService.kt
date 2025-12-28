package com.task.domain.task.service

import com.google.inject.ImplementedBy
import com.task.domain.taskExecution.TaskExecution
import com.task.usecase.task.service.TaskGenerationServiceImpl
import org.jooq.DSLContext
import java.time.LocalDate

@ImplementedBy(TaskGenerationServiceImpl::class)
interface TaskGenerationService {
    fun generateDailyTaskExecution(
        today: LocalDate,
        session: DSLContext
    ): List<TaskExecution.NotStarted>
}
