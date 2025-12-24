package com.task.infra.taskDefinition

import com.google.inject.Singleton
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*
import com.task.infra.database.jooq.tables.TaskDefinitions.Companion.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.TaskRecurrences.Companion.TASK_RECURRENCES
import org.jooq.DSLContext
import java.time.OffsetDateTime

@Singleton
class TaskDefinitionRepositoryImpl : TaskDefinitionRepository {

    override fun create(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition {
        val now = OffsetDateTime.now()

        val record = session.newRecord(TASK_DEFINITIONS).apply {
            id = taskDefinition.id.value
            name = taskDefinition.name.value
            description = taskDefinition.description.value
            estimatedMinutes = taskDefinition.estimatedMinutes
            scope = taskDefinition.scope.value
            ownerMemberId = taskDefinition.ownerMemberId?.value
            version = taskDefinition.version
            isDeleted = taskDefinition.isDeleted
            createdAt = now
            updatedAt = now

            when (val schedule = taskDefinition.schedule) {
                is TaskSchedule.OneTime -> {
                    scheduleType = "ONE_TIME"
                    oneTimeDeadline = schedule.deadline
                }
                is TaskSchedule.Recurring -> {
                    scheduleType = "RECURRING"
                    oneTimeDeadline = null
                }
            }
        }
        record.store()

        if (taskDefinition.schedule is TaskSchedule.Recurring) {
            saveRecurrence(taskDefinition.id, taskDefinition.schedule, session, now)
        }

        return taskDefinition
    }

    override fun update(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition {
        val now = OffsetDateTime.now()

        session
            .update(TASK_DEFINITIONS)
            .set(TASK_DEFINITIONS.NAME, taskDefinition.name.value)
            .set(TASK_DEFINITIONS.DESCRIPTION, taskDefinition.description.value)
            .set(TASK_DEFINITIONS.ESTIMATED_MINUTES, taskDefinition.estimatedMinutes)
            .set(TASK_DEFINITIONS.SCOPE, taskDefinition.scope.value)
            .set(TASK_DEFINITIONS.OWNER_MEMBER_ID, taskDefinition.ownerMemberId?.value)
            .set(TASK_DEFINITIONS.VERSION, taskDefinition.version)
            .set(TASK_DEFINITIONS.IS_DELETED, taskDefinition.isDeleted)
            .set(TASK_DEFINITIONS.UPDATED_AT, now)
            .apply {
                when (val schedule = taskDefinition.schedule) {
                    is TaskSchedule.OneTime -> {
                        set(TASK_DEFINITIONS.SCHEDULE_TYPE, "ONE_TIME")
                        set(TASK_DEFINITIONS.ONE_TIME_DEADLINE, schedule.deadline)
                    }
                    is TaskSchedule.Recurring -> {
                        set(TASK_DEFINITIONS.SCHEDULE_TYPE, "RECURRING")
                        set(TASK_DEFINITIONS.ONE_TIME_DEADLINE, null as java.time.LocalDate?)
                    }
                }
            }
            .where(TASK_DEFINITIONS.ID.eq(taskDefinition.id.value))
            .execute()

        session
            .deleteFrom(TASK_RECURRENCES)
            .where(TASK_RECURRENCES.TASK_DEFINITION_ID.eq(taskDefinition.id.value))
            .execute()

        if (taskDefinition.schedule is TaskSchedule.Recurring) {
            saveRecurrence(taskDefinition.id, taskDefinition.schedule, session, now)
        }

        return taskDefinition
    }

    override fun delete(id: TaskDefinitionId, session: DSLContext) {
        session
            .update(TASK_DEFINITIONS)
            .set(TASK_DEFINITIONS.IS_DELETED, true)
            .set(TASK_DEFINITIONS.UPDATED_AT, OffsetDateTime.now())
            .where(TASK_DEFINITIONS.ID.eq(id.value))
            .execute()
    }

    override fun findById(id: TaskDefinitionId, session: DSLContext): TaskDefinition? {
        val definitionRecord = session
            .selectFrom(TASK_DEFINITIONS)
            .where(TASK_DEFINITIONS.ID.eq(id.value))
            .and(TASK_DEFINITIONS.IS_DELETED.eq(false))
            .fetchOne()
            ?: return null

        val schedule = when (definitionRecord.scheduleType) {
            "ONE_TIME" -> {
                TaskSchedule.OneTime(
                    deadline = definitionRecord.oneTimeDeadline!!
                )
            }
            "RECURRING" -> {
                val recurrenceRecord = session
                    .selectFrom(TASK_RECURRENCES)
                    .where(TASK_RECURRENCES.TASK_DEFINITION_ID.eq(id.value))
                    .fetchOne()
                    ?: throw IllegalStateException("Recurring schedule record not found for task definition ${id.value}")

                val pattern = when (recurrenceRecord.patternType) {
                    "DAILY" -> RecurrencePattern.Daily(
                        skipWeekends = recurrenceRecord.dailySkipWeekends!!
                    )
                    "WEEKLY" -> RecurrencePattern.Weekly(
                        dayOfWeek = java.time.DayOfWeek.of(recurrenceRecord.weeklyDayOfWeek!!)
                    )
                    "MONTHLY" -> RecurrencePattern.Monthly(
                        dayOfMonth = recurrenceRecord.monthlyDayOfMonth!!
                    )
                    else -> throw IllegalStateException("Unknown pattern type: ${recurrenceRecord.patternType}")
                }

                TaskSchedule.Recurring(
                    pattern = pattern,
                    startDate = recurrenceRecord.startDate!!,
                    endDate = recurrenceRecord.endDate
                )
            }
            else -> throw IllegalStateException("Unknown schedule type: ${definitionRecord.scheduleType}")
        }

        return TaskDefinition.reconstruct(
            id = TaskDefinitionId(definitionRecord.id!!),
            name = TaskDefinitionName(definitionRecord.name!!),
            description = TaskDefinitionDescription(definitionRecord.description ?: ""),
            estimatedMinutes = definitionRecord.estimatedMinutes!!,
            scope = TaskScope.get(definitionRecord.scope!!),
            ownerMemberId = definitionRecord.ownerMemberId?.let { MemberId(it) },
            schedule = schedule,
            version = definitionRecord.version!!,
            isDeleted = definitionRecord.isDeleted!!
        )
    }

    private fun saveRecurrence(
        taskDefinitionId: TaskDefinitionId,
        recurring: TaskSchedule.Recurring,
        session: DSLContext,
        now: OffsetDateTime
    ) {
        session.insertInto(TASK_RECURRENCES)
            .set(TASK_RECURRENCES.TASK_DEFINITION_ID, taskDefinitionId.value)
            .set(TASK_RECURRENCES.START_DATE, recurring.startDate)
            .set(TASK_RECURRENCES.END_DATE, recurring.endDate)
            .set(TASK_RECURRENCES.CREATED_AT, now)
            .set(TASK_RECURRENCES.UPDATED_AT, now)
            .apply {
                when (val pattern = recurring.pattern) {
                    is RecurrencePattern.Daily -> {
                        set(TASK_RECURRENCES.PATTERN_TYPE, "DAILY")
                        set(TASK_RECURRENCES.DAILY_SKIP_WEEKENDS, pattern.skipWeekends)
                    }
                    is RecurrencePattern.Weekly -> {
                        set(TASK_RECURRENCES.PATTERN_TYPE, "WEEKLY")
                        set(TASK_RECURRENCES.WEEKLY_DAY_OF_WEEK, pattern.dayOfWeek.value)
                    }
                    is RecurrencePattern.Monthly -> {
                        set(TASK_RECURRENCES.PATTERN_TYPE, "MONTHLY")
                        set(TASK_RECURRENCES.MONTHLY_DAY_OF_MONTH, pattern.dayOfMonth)
                    }
                }
            }
            .execute()
    }
}
