package com.task.usecase.query.notifications

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.infra.query.UpcomingNotDailyTaskQueryServiceImpl
import org.jooq.DSLContext
import java.time.LocalDate
import java.time.LocalTime

@ImplementedBy(UpcomingNotDailyTaskQueryServiceImpl::class)
interface UpcomingNotDailyTaskQueryService {

    data class NotificationForMember(
        val memberId: MemberId,
        val taskNames: List<TaskDefinitionName>
    )

    fun fetchUpcomingNotDailyTasks(
        session: DSLContext,
        windowStartDate: LocalDate,
        windowStartTime: LocalTime,
        windowEndDate: LocalDate,
        windowEndTime: LocalTime
    ): List<NotificationForMember>
}
