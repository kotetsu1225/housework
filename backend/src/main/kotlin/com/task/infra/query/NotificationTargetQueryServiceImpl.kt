package com.task.infra.query

import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_RECURRENCES
import com.task.infra.database.jooq.tables.references.TASK_SNAPSHOTS
import com.task.usecase.query.notifications.NotificationTargetQueryService
import com.task.usecase.task.SendDailyNotCompletedTaskNotificationsUseCase.NotificationForMember
import org.jooq.DSLContext
import org.jooq.impl.DSL
import java.time.LocalDate
import java.util.UUID

class NotificationTargetQueryServiceImpl : NotificationTargetQueryService {

    private data class TaskRow(
        val scope: String,
        val ownerMemberId: UUID?,
        val taskName: String
    )

    override fun fetchNotCompletedDailyTasks(
        session: DSLContext,
        targetDate: LocalDate
    ): List<NotificationForMember> {
        val taskName = DSL.case_()
            .`when`(TASK_EXECUTIONS.STATUS.eq("NOT_STARTED"), TASK_DEFINITIONS.NAME)
            .`when`(TASK_EXECUTIONS.STATUS.eq("IN_PROGRESS"), TASK_SNAPSHOTS.NAME)

        val allTasks = session.select(
            TASK_DEFINITIONS.SCOPE,
            TASK_DEFINITIONS.OWNER_MEMBER_ID,
            taskName.`as`("task_name")
        )
            .from(TASK_EXECUTIONS)
            .join(TASK_DEFINITIONS)
                .on(TASK_DEFINITIONS.ID.eq(TASK_EXECUTIONS.TASK_DEFINITION_ID))
            .join(TASK_RECURRENCES)
                .on(TASK_RECURRENCES.TASK_DEFINITION_ID.eq(TASK_DEFINITIONS.ID))
                .and(TASK_RECURRENCES.PATTERN_TYPE.eq("DAILY"))
            .leftJoin(TASK_SNAPSHOTS)
                .on(TASK_SNAPSHOTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
            .where(TASK_EXECUTIONS.SCHEDULED_DATE.eq(targetDate))
            .and(TASK_EXECUTIONS.STATUS.`in`("NOT_STARTED", "IN_PROGRESS"))
            .and(TASK_DEFINITIONS.IS_DELETED.eq(false))
            .and(TASK_DEFINITIONS.SCHEDULE_TYPE.eq("RECURRING"))
            .fetch { record ->
                TaskRow(
                    scope = record.get(TASK_DEFINITIONS.SCOPE) ?: "FAMILY",
                    ownerMemberId = record.get(TASK_DEFINITIONS.OWNER_MEMBER_ID),
                    taskName = record.get("task_name", String::class.java) ?: ""
                )
            }

        val familyTaskNames = allTasks
            .filter { it.scope == "FAMILY" }
            .map { TaskDefinitionName(it.taskName) }

        val personalTasksByOwner = allTasks
            .filter { it.scope == "PERSONAL" && it.ownerMemberId != null }
            .groupBy { it.ownerMemberId!! }
            .mapValues { (_, tasks) -> tasks.map { TaskDefinitionName(it.taskName) } }

        return if (familyTaskNames.isNotEmpty()) {
            val allMemberIds = session.select(MEMBERS.ID)
                .from(MEMBERS)
                .fetch { it.get(MEMBERS.ID)!! }

            allMemberIds.map { memberId ->
                val personalTasks = personalTasksByOwner[memberId] ?: emptyList()
                NotificationForMember(
                    memberId = MemberId(memberId),
                    notCompletedDailyTaskNames = familyTaskNames + personalTasks
                )
            }
        } else {
            personalTasksByOwner.map { (memberId, taskNames) ->
                NotificationForMember(
                    memberId = MemberId(memberId),
                    notCompletedDailyTaskNames = taskNames
                )
            }
        }
    }
}
