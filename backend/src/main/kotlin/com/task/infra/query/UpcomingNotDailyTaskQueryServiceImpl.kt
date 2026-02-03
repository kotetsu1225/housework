package com.task.infra.query

import com.google.inject.Inject
import com.task.domain.member.MemberId
import com.task.domain.member.MemberRepository
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_RECURRENCES
import com.task.usecase.query.notifications.UpcomingNotDailyTaskQueryService
import com.task.usecase.query.notifications.UpcomingNotDailyTaskQueryService.NotificationForMember
import org.jooq.Condition
import org.jooq.DSLContext
import org.jooq.impl.DSL
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

class UpcomingNotDailyTaskQueryServiceImpl @Inject constructor(
    private val memberRepository: MemberRepository,
) : UpcomingNotDailyTaskQueryService {

    private data class TaskRow(
        val taskName: String,
        val scope: String,
        val ownerMemberId: UUID?
    )

    override fun fetchUpcomingNotDailyTasks(
        session: DSLContext,
        windowStartDate: LocalDate,
        windowStartTime: LocalTime,
        windowEndDate: LocalDate,
        windowEndTime: LocalTime
    ): List<NotificationForMember> {
        val allMembers = memberRepository.findAll(session)

        // scheduled_start_time から時刻部分を抽出
        val scheduledTimeField = DSL.field(
            "({0} AT TIME ZONE 'Asia/Tokyo')::time",
            LocalTime::class.java,
            TASK_DEFINITIONS.SCHEDULED_START_TIME
        )

        val notDailyCondition = TASK_DEFINITIONS.SCHEDULE_TYPE.eq("ONE_TIME")
            .or(
                TASK_DEFINITIONS.SCHEDULE_TYPE.eq("RECURRING")
                    .and(
                        DSL.notExists(
                            DSL.selectOne()
                                .from(TASK_RECURRENCES)
                                .where(TASK_RECURRENCES.TASK_DEFINITION_ID.eq(TASK_DEFINITIONS.ID))
                                .and(TASK_RECURRENCES.PATTERN_TYPE.eq("DAILY"))
                        )
                    )
            )

        val dateTimeCondition: Condition = if (windowStartDate == windowEndDate) {
            TASK_EXECUTIONS.SCHEDULED_DATE.eq(windowStartDate)
                .and(scheduledTimeField.between(windowStartTime, windowEndTime))
        } else {
            TASK_EXECUTIONS.SCHEDULED_DATE.eq(windowStartDate)
                .and(scheduledTimeField.greaterOrEqual(windowStartTime))
                .or(
                    TASK_EXECUTIONS.SCHEDULED_DATE.eq(windowEndDate)
                        .and(scheduledTimeField.lessOrEqual(windowEndTime))
                )
        }

        val taskRows = session.select(
            TASK_DEFINITIONS.NAME,
            TASK_DEFINITIONS.SCOPE,
            TASK_DEFINITIONS.OWNER_MEMBER_ID
        )
            .from(TASK_EXECUTIONS)
            .join(TASK_DEFINITIONS)
            .on(TASK_DEFINITIONS.ID.eq(TASK_EXECUTIONS.TASK_DEFINITION_ID))
            .where(TASK_EXECUTIONS.STATUS.eq("NOT_STARTED"))
            .and(TASK_DEFINITIONS.IS_DELETED.eq(false))
            .and(notDailyCondition)
            .and(dateTimeCondition)
            .fetch { record ->
                TaskRow(
                    taskName = record.get(TASK_DEFINITIONS.NAME) ?: "",
                    scope = record.get(TASK_DEFINITIONS.SCOPE) ?: "FAMILY",
                    ownerMemberId = record.get(TASK_DEFINITIONS.OWNER_MEMBER_ID)
                )
            }

        // FAMILYタスク → 全員に割り当て
        val familyTaskNames = taskRows
            .filter { it.scope == "FAMILY" }
            .map { TaskDefinitionName(it.taskName) }

        // PERSONALタスク → オーナーごとにグルーピング
        val personalTasksByOwner = taskRows
            .filter { it.scope == "PERSONAL" && it.ownerMemberId != null }
            .groupBy { it.ownerMemberId!! }
            .mapValues { (_, tasks) -> tasks.map { TaskDefinitionName(it.taskName) } }

        return if (familyTaskNames.isNotEmpty()) {
            allMembers.map { member ->
                val personalTasks = personalTasksByOwner[member.id.value] ?: emptyList()
                NotificationForMember(
                    memberId = member.id,
                    taskNames = familyTaskNames + personalTasks
                )
            }.filter { it.taskNames.isNotEmpty() }
        } else {
            personalTasksByOwner.map { (memberId, taskNames) ->
                NotificationForMember(
                    memberId = MemberId(memberId),
                    taskNames = taskNames
                )
            }
        }
    }
}
