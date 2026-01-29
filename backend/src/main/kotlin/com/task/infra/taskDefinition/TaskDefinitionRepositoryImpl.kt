package com.task.infra.taskDefinition

import com.google.inject.Singleton
import com.task.domain.AppTimeZone
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.*
import com.task.infra.database.jooq.tables.TaskDefinitions.Companion.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.TaskRecurrences.Companion.TASK_RECURRENCES
import com.task.infra.database.jooq.tables.TaskExecutions.Companion.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.records.TaskDefinitionsRecord
import com.task.infra.database.jooq.tables.records.TaskRecurrencesRecord
import org.jooq.DSLContext
import org.jooq.Condition
import org.jooq.Field
import org.jooq.impl.DSL.multiset
import org.jooq.impl.DSL.select
import org.jooq.impl.DSL.selectOne
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime

@Singleton
class TaskDefinitionRepositoryImpl : TaskDefinitionRepository {

    private fun Instant.toOffsetDateTime(): OffsetDateTime =
        this.atZone(AppTimeZone.ZONE).toOffsetDateTime()

    private fun OffsetDateTime.toDomainInstant(): Instant = this.toInstant()

    private val recurrenceField: Field<TaskRecurrencesRecord?> = multiset(
        select(TASK_RECURRENCES.asterisk())
            .from(TASK_RECURRENCES)
            .where(TASK_RECURRENCES.TASK_DEFINITION_ID.eq(TASK_DEFINITIONS.ID))
    ).convertFrom { r -> r.into(TaskRecurrencesRecord::class.java).firstOrNull() }

    override fun create(taskDefinition: TaskDefinition, session: DSLContext): TaskDefinition {
        val now = OffsetDateTime.now()

        val record = session.newRecord(TASK_DEFINITIONS).apply {
            id = taskDefinition.id.value
            name = taskDefinition.name.value
            description = taskDefinition.description.value
            scheduledStartTime = taskDefinition.scheduledTimeRange.startTime.toOffsetDateTime()
            scheduledEndTime = taskDefinition.scheduledTimeRange.endTime.toOffsetDateTime()
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
            .set(TASK_DEFINITIONS.SCHEDULED_START_TIME, taskDefinition.scheduledTimeRange.startTime.toOffsetDateTime())
            .set(TASK_DEFINITIONS.SCHEDULED_END_TIME, taskDefinition.scheduledTimeRange.endTime.toOffsetDateTime())
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

    // MULTISETを使用して1回のクエリでTaskDefinitionと関連するTaskRecurrenceを取得
    // N+1問題を回避し、データベースラウンドトリップを最小化
    // 出典: https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/multiset-value-constructor/
    override fun findById(id: TaskDefinitionId, session: DSLContext): TaskDefinition? {
        return session
            .select(TASK_DEFINITIONS.asterisk(), recurrenceField)
            .from(TASK_DEFINITIONS)
            .where(TASK_DEFINITIONS.ID.eq(id.value))
            .and(TASK_DEFINITIONS.IS_DELETED.eq(false))
            .fetchOne { record ->
                val defRecord = record.into(TaskDefinitionsRecord::class.java)
                // Field変数を使用した型安全なアクセス（キャスト不要）
                val recurrenceRecord = record.get(recurrenceField)
                reconstructFromRecords(defRecord, recurrenceRecord)
            }
    }

    override fun findAll(session: DSLContext, limit: Int, offset: Int): List<TaskDefinition> {
        return session
            .select(TASK_DEFINITIONS.asterisk(), recurrenceField)
            .from(TASK_DEFINITIONS)
            .where(TASK_DEFINITIONS.IS_DELETED.eq(false))
            .orderBy(TASK_DEFINITIONS.CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch { record ->
                val defRecord = record.into(TaskDefinitionsRecord::class.java)
                val recurrenceRecord = record.get(recurrenceField)
                reconstructFromRecords(defRecord, recurrenceRecord)
            }
    }

    override fun count(session: DSLContext): Int {
        return session
            .selectCount()
            .from(TASK_DEFINITIONS)
            .where(TASK_DEFINITIONS.IS_DELETED.eq(false))
            .fetchOne(0, Int::class.java) ?: 0
    }

    private fun taskSettingsCondition(today: LocalDate): Condition {
        val notOneTime = TASK_DEFINITIONS.SCHEDULE_TYPE.ne("ONE_TIME")

        val oneTimeActive = TASK_DEFINITIONS.SCHEDULE_TYPE.eq("ONE_TIME")
            .and(TASK_DEFINITIONS.ONE_TIME_DEADLINE.ge(today))
            .and(
                org.jooq.impl.DSL.notExists(
                    selectOne()
                        .from(TASK_EXECUTIONS)
                        .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(TASK_DEFINITIONS.ID))
                        .and(TASK_EXECUTIONS.STATUS.`in`("COMPLETED", "CANCELLED"))
                )
            )

        return TASK_DEFINITIONS.IS_DELETED.eq(false)
            .and(notOneTime.or(oneTimeActive))
    }

    override fun findAllForTaskSettings(session: DSLContext, today: LocalDate, limit: Int, offset: Int): List<TaskDefinition> {
        return session
            .select(TASK_DEFINITIONS.asterisk(), recurrenceField)
            .from(TASK_DEFINITIONS)
            .where(taskSettingsCondition(today))
            .orderBy(TASK_DEFINITIONS.CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch { record ->
                val defRecord = record.into(TaskDefinitionsRecord::class.java)
                val recurrenceRecord = record.get(recurrenceField)
                reconstructFromRecords(defRecord, recurrenceRecord)
            }
    }

    override fun countForTaskSettings(session: DSLContext, today: LocalDate): Int {
        return session
            .selectCount()
            .from(TASK_DEFINITIONS)
            .where(taskSettingsCondition(today))
            .fetchOne(0, Int::class.java) ?: 0
    }

    override fun findAllRecurringActive(session: DSLContext): List<TaskDefinition> {
        return session
            .select(TASK_DEFINITIONS.asterisk(), recurrenceField)
            .from(TASK_DEFINITIONS)
            .where(TASK_DEFINITIONS.IS_DELETED.eq(false))
            .and(TASK_DEFINITIONS.SCHEDULE_TYPE.eq("RECURRING"))
            .fetch { record ->
                val definitionRecord = record.into(TaskDefinitionsRecord::class.java)
                val recurrenceRecord = record.get(recurrenceField)
                reconstructFromRecords(definitionRecord, recurrenceRecord)
            }
    }

    private fun reconstructFromRecords(
        definitionRecord: TaskDefinitionsRecord,
        recurrenceRecord: TaskRecurrencesRecord?
    ): TaskDefinition {
        val schedule = when (definitionRecord.scheduleType) {
            "ONE_TIME" -> {
                TaskSchedule.OneTime(
                    deadline = definitionRecord.oneTimeDeadline!!
                )
            }
            "RECURRING" -> {
                if (recurrenceRecord == null) {
                    throw IllegalStateException("Recurring schedule record not found for task definition ${definitionRecord.id}")
                }

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
                    startDate = recurrenceRecord.startDate,
                    endDate = recurrenceRecord.endDate
                )
            }
            else -> throw IllegalStateException("Unknown schedule type: ${definitionRecord.scheduleType}")
        }

        return TaskDefinition.reconstruct(
            id = TaskDefinitionId(definitionRecord.id!!),
            name = TaskDefinitionName(definitionRecord.name),
            description = TaskDefinitionDescription(definitionRecord.description ?: ""),
            scheduledTimeRange = ScheduledTimeRange(
                startTime = definitionRecord.scheduledStartTime.toDomainInstant(),
                endTime = definitionRecord.scheduledEndTime.toDomainInstant(),
            ),
            scope = TaskScope.get(definitionRecord.scope),
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
