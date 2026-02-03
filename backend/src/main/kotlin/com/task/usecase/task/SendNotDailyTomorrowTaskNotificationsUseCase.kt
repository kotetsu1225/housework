package com.task.usecase.task

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionName
import java.time.LocalDate

@ImplementedBy(SendNotDailyTomorrowTaskNotificationsUseCaseImpl::class)
interface SendNotDailyTomorrowTaskNotificationsUseCase {
    data class Input(val targetDate: LocalDate)

    data class NotificationTasksOutput(
        val notificationsForMember: List<NotificationForMember>
    )

    data class NotificationForMember(
        val memberId: MemberId,
        val tomorrowTaskNames: List<TaskDefinitionName>
    )

    sealed class ExecutionResult {
        data object Success : ExecutionResult()
        data class Failed(val status: String, val message: String) : ExecutionResult()
    }

    fun execute(input: Input): ExecutionResult
}