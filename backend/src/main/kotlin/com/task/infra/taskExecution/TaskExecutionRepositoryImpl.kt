package com.task.infra.taskExecution

import com.google.inject.Singleton
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.domain.taskExecution.TaskSnapshot
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_SNAPSHOTS
import org.jooq.DSLContext
import org.jooq.Record
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import com.task.domain.AppTimeZone
import java.util.UUID

@Singleton
class TaskExecutionRepositoryImpl : TaskExecutionRepository {

    private fun Instant.toOffsetDateTime(): OffsetDateTime =
        this.atZone(AppTimeZone.ZONE).toOffsetDateTime()

    private fun OffsetDateTime.toDomainInstant(): Instant = this.toInstant()

    private fun Instant.toLocalDate(): LocalDate =
        this.atZone(AppTimeZone.ZONE).toLocalDate()

    private fun LocalDate.toDomainInstant(): Instant =
        this.atStartOfDay(AppTimeZone.ZONE).toInstant()

    override fun create(taskExecution: TaskExecution.NotStarted, session: DSLContext): TaskExecution.NotStarted {
        val now = OffsetDateTime.now()

        session.insertInto(TASK_EXECUTIONS)
            .set(TASK_EXECUTIONS.ID, taskExecution.id.value)
            .set(TASK_EXECUTIONS.TASK_DEFINITION_ID, taskExecution.taskDefinitionId.value)
            .set(TASK_EXECUTIONS.ASSIGNEE_MEMBER_ID, taskExecution.assigneeMemberId?.value)
            .set(TASK_EXECUTIONS.SCHEDULED_DATE, taskExecution.scheduledDate.toLocalDate())
            .set(TASK_EXECUTIONS.STATUS, "NOT_STARTED")
            .set(TASK_EXECUTIONS.CREATED_AT, now)
            .set(TASK_EXECUTIONS.UPDATED_AT, now)
            .execute()

        return taskExecution
    }

    override fun update(taskExecution: TaskExecution, session: DSLContext): TaskExecution {
        val now = OffsetDateTime.now()

        val updateStep = session.update(TASK_EXECUTIONS)
            .set(TASK_EXECUTIONS.UPDATED_AT, now)

        when (taskExecution) {
            is TaskExecution.NotStarted -> updateStep
                .set(TASK_EXECUTIONS.ASSIGNEE_MEMBER_ID, taskExecution.assigneeMemberId?.value)

            is TaskExecution.InProgress -> {
                insertSnapshot(taskExecution.id.value, taskExecution.taskSnapshot, session)
                updateStep
                    .set(TASK_EXECUTIONS.STATUS, "IN_PROGRESS")
                    .set(TASK_EXECUTIONS.ASSIGNEE_MEMBER_ID, taskExecution.assigneeMemberId.value)
                    .set(TASK_EXECUTIONS.STARTED_AT, taskExecution.startedAt.toOffsetDateTime())
            }

            is TaskExecution.Completed -> updateStep
                .set(TASK_EXECUTIONS.STATUS, "COMPLETED")
                .set(TASK_EXECUTIONS.COMPLETED_AT, taskExecution.completedAt.toOffsetDateTime())
                .set(TASK_EXECUTIONS.COMPLETED_BY_MEMBER_ID, taskExecution.completedByMemberId.value)

            is TaskExecution.Cancelled -> updateStep
                .set(TASK_EXECUTIONS.STATUS, "CANCELLED")

        }.where(TASK_EXECUTIONS.ID.eq(taskExecution.id.value)).execute()

        return taskExecution
    }

    private fun insertSnapshot(taskExecutionId: UUID, snapshot: TaskSnapshot, session: DSLContext) {
        session.insertInto(TASK_SNAPSHOTS)
            .set(TASK_SNAPSHOTS.TASK_EXECUTION_ID, taskExecutionId)
            .set(TASK_SNAPSHOTS.NAME, snapshot.frozenName.value)
            .set(TASK_SNAPSHOTS.DESCRIPTION, snapshot.frozenDescription.value)
            .set(TASK_SNAPSHOTS.ESTIMATED_MINUTES, snapshot.frozenEstimatedMinutes)
            .set(TASK_SNAPSHOTS.DEFINITION_VERSION, snapshot.definitionVersion)
            .set(TASK_SNAPSHOTS.CREATED_AT, snapshot.capturedAt.toOffsetDateTime())
            .execute()
    }

    override fun findById(id: TaskExecutionId, session: DSLContext): TaskExecution? {
        val record = session.select()
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.ID.eq(id.value))
            .fetchOne() ?: return null

        return reconstructFromRecord(record)
    }

    override fun findAll(session: DSLContext, limit: Int, offset: Int): List<TaskExecution> {
        return session.select()
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch()
            .map { reconstructFromRecord(it) }
    }

    override fun count(session: DSLContext): Int {
        return session.selectCount()
            .from(TASK_EXECUTIONS)
            .fetchOne(0, Int::class.java) ?: 0
    }

    override fun findByScheduledDate(scheduledDate: LocalDate, session: DSLContext): List<TaskExecution> {
        return session.select()
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.SCHEDULED_DATE.eq(scheduledDate))
            .orderBy(TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch()
            .map { reconstructFromRecord(it) }
    }

    override fun findByAssigneeMemberId(memberId: MemberId, session: DSLContext): List<TaskExecution> {
        return session.select()
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.ASSIGNEE_MEMBER_ID.eq(memberId.value))
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch()
            .map { reconstructFromRecord(it) }
    }

    override fun findByDefinitionAndDate(
        taskDefinitionId: TaskDefinitionId,
        scheduledDate: LocalDate,
        session: DSLContext
    ): TaskExecution? {
        val record = session.select()
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(taskDefinitionId.value))
            .and(TASK_EXECUTIONS.SCHEDULED_DATE.eq(scheduledDate))
            .fetchOne() ?: return null

        return reconstructFromRecord(record)
    }

    private fun reconstructFromRecord(record: Record): TaskExecution {
        val id = TaskExecutionId(record.get(TASK_EXECUTIONS.ID)!!)
        val taskDefinitionId = TaskDefinitionId(record.get(TASK_EXECUTIONS.TASK_DEFINITION_ID)!!)
        val scheduledDate = record.get(TASK_EXECUTIONS.SCHEDULED_DATE)!!.toDomainInstant()
        val assigneeMemberIdRaw = record.get(TASK_EXECUTIONS.ASSIGNEE_MEMBER_ID)
        val status = record.get(TASK_EXECUTIONS.STATUS)!!

        return when (status) {
            "NOT_STARTED" -> TaskExecution.reconstructNotStarted(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberId = assigneeMemberIdRaw?.let { MemberId(it) }
            )

            "IN_PROGRESS" -> TaskExecution.reconstructInProgress(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberId = MemberId(assigneeMemberIdRaw!!),
                taskSnapshot = reconstructSnapshot(record),
                startedAt = record.get(TASK_EXECUTIONS.STARTED_AT)!!.toDomainInstant()
            )

            "COMPLETED" -> TaskExecution.reconstructCompleted(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberId = MemberId(assigneeMemberIdRaw!!),
                taskSnapshot = reconstructSnapshot(record),
                startedAt = record.get(TASK_EXECUTIONS.STARTED_AT)!!.toDomainInstant(),
                completedAt = record.get(TASK_EXECUTIONS.COMPLETED_AT)!!.toDomainInstant(),
                completedByMemberId = MemberId(record.get(TASK_EXECUTIONS.COMPLETED_BY_MEMBER_ID)!!)
            )

            "CANCELLED" -> TaskExecution.reconstructCancelled(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberId = assigneeMemberIdRaw?.let { MemberId(it) },
                taskSnapshot = reconstructSnapshotOrNull(record),
                startedAt = record.get(TASK_EXECUTIONS.STARTED_AT)?.toDomainInstant(),
                cancelledAt = record.get(TASK_EXECUTIONS.UPDATED_AT)!!.toDomainInstant()
            )

            else -> throw IllegalStateException("Unknown status: $status")
        }
    }

    private fun reconstructSnapshot(record: Record): TaskSnapshot {
        return TaskSnapshot(
            frozenName = TaskDefinitionName(record.get(TASK_SNAPSHOTS.NAME)!!),
            frozenDescription = TaskDefinitionDescription(record.get(TASK_SNAPSHOTS.DESCRIPTION) ?: ""),
            frozenEstimatedMinutes = record.get(TASK_SNAPSHOTS.ESTIMATED_MINUTES)!!,
            definitionVersion = record.get(TASK_SNAPSHOTS.DEFINITION_VERSION)!!,
            capturedAt = record.get(TASK_SNAPSHOTS.CREATED_AT)!!.toDomainInstant()
        )
    }

    private fun reconstructSnapshotOrNull(record: Record): TaskSnapshot? {
        val name = record.get(TASK_SNAPSHOTS.NAME) ?: return null
        return TaskSnapshot(
            frozenName = TaskDefinitionName(name),
            frozenDescription = TaskDefinitionDescription(record.get(TASK_SNAPSHOTS.DESCRIPTION) ?: ""),
            frozenEstimatedMinutes = record.get(TASK_SNAPSHOTS.ESTIMATED_MINUTES)!!,
            definitionVersion = record.get(TASK_SNAPSHOTS.DEFINITION_VERSION)!!,
            capturedAt = record.get(TASK_SNAPSHOTS.CREATED_AT)!!.toDomainInstant()
        )
    }
}
