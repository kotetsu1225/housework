package com.task.infra.taskExecution

import com.google.inject.Singleton
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionId
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.domain.taskExecution.TaskSnapshot
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_SNAPSHOTS
import com.task.usecase.taskExecution.get.GetTaskExecutionsUseCase
import org.jooq.Condition
import org.jooq.DSLContext
import org.jooq.Record
import org.jooq.impl.DSL
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import com.task.domain.AppTimeZone
import java.util.UUID
import org.jooq.Field

@Singleton
class TaskExecutionRepositoryImpl : TaskExecutionRepository {

    private fun Instant.toOffsetDateTime(): OffsetDateTime =
        this.atZone(AppTimeZone.ZONE).toOffsetDateTime()

    private fun OffsetDateTime.toDomainInstant(): Instant = this.toInstant()

    private fun Instant.toLocalDate(): LocalDate =
        this.atZone(AppTimeZone.ZONE).toLocalDate()

    private fun LocalDate.toDomainInstant(): Instant =
        this.atStartOfDay(AppTimeZone.ZONE).toInstant()

    private fun assigneeMemberIdField(): Field<UUID?> {
        val tep = TASK_EXECUTION_PARTICIPANTS
        return DSL.select(tep.MEMBER_ID)
            .from(tep)
            .where(tep.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
            .orderBy(tep.JOINED_AT.asc())
            .limit(1)
            .asField("assignee_member_id")
    }

    private fun completedByMemberIdField(): Field<UUID?> {
        val tep = TASK_EXECUTION_PARTICIPANTS
        return DSL.select(tep.MEMBER_ID)
            .from(tep)
            .where(tep.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
            .orderBy(tep.JOINED_AT.desc())
            .limit(1)
            .asField("completed_by_member_id")
    }

    private fun taskExecutionSelectFields(
        assigneeMemberId: Field<UUID?>,
        completedByMemberId: Field<UUID?>
    ): Array<Field<*>> {
        return arrayOf(
            *TASK_EXECUTIONS.fields(),
            *TASK_SNAPSHOTS.fields(),
            assigneeMemberId,
            completedByMemberId
        )
    }

    private fun upsertParticipant(taskExecutionId: UUID, memberId: UUID, joinedAt: OffsetDateTime, session: DSLContext) {
        session.insertInto(TASK_EXECUTION_PARTICIPANTS)
            .set(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID, taskExecutionId)
            .set(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID, memberId)
            .set(TASK_EXECUTION_PARTICIPANTS.JOINED_AT, joinedAt)
            .onConflictDoNothing()
            .execute()
    }

    override fun create(taskExecution: TaskExecution.NotStarted, session: DSLContext): TaskExecution.NotStarted {
        val now = OffsetDateTime.now()

        session.insertInto(TASK_EXECUTIONS)
            .set(TASK_EXECUTIONS.ID, taskExecution.id.value)
            .set(TASK_EXECUTIONS.TASK_DEFINITION_ID, taskExecution.taskDefinitionId.value)
            .set(TASK_EXECUTIONS.SCHEDULED_DATE, taskExecution.scheduledDate.toLocalDate())
            .set(TASK_EXECUTIONS.STATUS, "NOT_STARTED")
            .set(TASK_EXECUTIONS.CREATED_AT, now)
            .set(TASK_EXECUTIONS.UPDATED_AT, now)
            .execute()

        taskExecution.assigneeMemberId?.let { assigneeId ->
            upsertParticipant(taskExecution.id.value, assigneeId.value, now, session)
        }

        return taskExecution
    }

    override fun update(taskExecution: TaskExecution, session: DSLContext): TaskExecution {
        val now = OffsetDateTime.now()

        val updateStep = session.update(TASK_EXECUTIONS)
            .set(TASK_EXECUTIONS.UPDATED_AT, now)

        when (taskExecution) {
            is TaskExecution.NotStarted -> updateStep
                .also {
                    taskExecution.assigneeMemberId?.let { assigneeId ->
                        upsertParticipant(taskExecution.id.value, assigneeId.value, now, session)
                    }
                }

            is TaskExecution.InProgress -> updateStep
                .set(TASK_EXECUTIONS.STATUS, "IN_PROGRESS")
                .set(TASK_EXECUTIONS.STARTED_AT, taskExecution.startedAt.toOffsetDateTime())
                .also {
                    insertSnapshot(taskExecution.id.value, taskExecution.taskSnapshot, session)
                    upsertParticipant(taskExecution.id.value, taskExecution.assigneeMemberId.value, taskExecution.startedAt.toOffsetDateTime(), session)
                }

            is TaskExecution.Completed -> updateStep
                .set(TASK_EXECUTIONS.STATUS, "COMPLETED")
                .set(TASK_EXECUTIONS.COMPLETED_AT, taskExecution.completedAt.toOffsetDateTime())
                .also {
                    upsertParticipant(taskExecution.id.value, taskExecution.completedByMemberId.value, taskExecution.completedAt.toOffsetDateTime(), session)
                }

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
            .set(TASK_SNAPSHOTS.SCHEDULED_START_TIME, snapshot.frozenScheduledTimeRange.startTime.toOffsetDateTime())
            .set(TASK_SNAPSHOTS.SCHEDULED_END_TIME, snapshot.frozenScheduledTimeRange.endTime.toOffsetDateTime())
            .set(TASK_SNAPSHOTS.DEFINITION_VERSION, snapshot.definitionVersion)
            .set(TASK_SNAPSHOTS.CREATED_AT, snapshot.capturedAt.toOffsetDateTime())
            .execute()
    }

    override fun findById(id: TaskExecutionId, session: DSLContext): TaskExecution? {
        val assigneeMemberId = assigneeMemberIdField()
        val completedByMemberId = completedByMemberIdField()
        val record = session.select(*taskExecutionSelectFields(assigneeMemberId, completedByMemberId))
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.ID.eq(id.value))
            .fetchOne() ?: return null

        return reconstructFromRecord(record)
    }

    override fun findAll(session: DSLContext, limit: Int, offset: Int): List<TaskExecution> {
        val assigneeMemberId = assigneeMemberIdField()
        val completedByMemberId = completedByMemberIdField()
        return session.select(*taskExecutionSelectFields(assigneeMemberId, completedByMemberId))
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

    override fun findAllWithFilter(
        session: DSLContext,
        limit: Int,
        offset: Int,
        filter: GetTaskExecutionsUseCase.FilterSpec
    ): List<TaskExecution> {
        val condition = buildFilterCondition(filter)
        val assigneeMemberId = assigneeMemberIdField()
        val completedByMemberId = completedByMemberIdField()

        return session.select(*taskExecutionSelectFields(assigneeMemberId, completedByMemberId))
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(condition)
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch()
            .map { reconstructFromRecord(it) }
    }

    override fun countWithFilter(session: DSLContext, filter: GetTaskExecutionsUseCase.FilterSpec): Int {
        val condition = buildFilterCondition(filter)

        return session.selectCount()
            .from(TASK_EXECUTIONS)
            .where(condition)
            .fetchOne(0, Int::class.java) ?: 0
    }

    /**
     * FilterSpecからJOOQ Conditionを動的に構築する
     *
     * JOOQ Conditionのチェーン:
     * - DSL.noCondition() は常にtrueを返す空条件（初期値として使用）
     * - .and() で条件を追加していく
     * - nullの場合は条件を追加しない
     */
    private fun buildFilterCondition(filter: GetTaskExecutionsUseCase.FilterSpec): Condition {
        var condition: Condition = DSL.noCondition()

        filter.scheduledDate?.let { date ->
            condition = condition.and(TASK_EXECUTIONS.SCHEDULED_DATE.eq(date))
        }

        filter.status?.let { status ->
            condition = condition.and(TASK_EXECUTIONS.STATUS.eq(status))
        }

        filter.assigneeMemberId?.let { memberId ->
            condition = condition.and(
                DSL.exists(
                    DSL.selectOne()
                        .from(TASK_EXECUTION_PARTICIPANTS)
                        .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
                        .and(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.eq(memberId.value))
                )
            )
        }

        return condition
    }

    override fun findByScheduledDate(scheduledDate: LocalDate, session: DSLContext): List<TaskExecution> {
        val assigneeMemberId = assigneeMemberIdField()
        val completedByMemberId = completedByMemberIdField()
        return session.select(*taskExecutionSelectFields(assigneeMemberId, completedByMemberId))
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.SCHEDULED_DATE.eq(scheduledDate))
            .orderBy(TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch()
            .map { reconstructFromRecord(it) }
    }

    override fun findByAssigneeMemberId(memberId: MemberId, session: DSLContext): List<TaskExecution> {
        val assigneeMemberId = assigneeMemberIdField()
        val completedByMemberId = completedByMemberIdField()
        return session.select(*taskExecutionSelectFields(assigneeMemberId, completedByMemberId))
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(
                DSL.exists(
                    DSL.selectOne()
                        .from(TASK_EXECUTION_PARTICIPANTS)
                        .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
                        .and(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.eq(memberId.value))
                )
            )
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch()
            .map { reconstructFromRecord(it) }
    }

    override fun findByDefinitionAndDate(
        taskDefinitionId: TaskDefinitionId,
        scheduledDate: LocalDate,
        session: DSLContext
    ): TaskExecution? {
        val assigneeMemberId = assigneeMemberIdField()
        val completedByMemberId = completedByMemberIdField()
        val record = session.select(*taskExecutionSelectFields(assigneeMemberId, completedByMemberId))
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(taskDefinitionId.value))
            .and(TASK_EXECUTIONS.SCHEDULED_DATE.eq(scheduledDate))
            .fetchOne() ?: return null

        return reconstructFromRecord(record)
    }

    override fun findByDefinitionId(definitionId: TaskDefinitionId, session: DSLContext): List<TaskExecution>? {
        val assigneeMemberId = assigneeMemberIdField()
        val completedByMemberId = completedByMemberIdField()
        return session.select(*taskExecutionSelectFields(assigneeMemberId, completedByMemberId))
            .from(TASK_EXECUTIONS)
            .leftJoin(TASK_SNAPSHOTS)
            .on(TASK_EXECUTIONS.ID.eq(TASK_SNAPSHOTS.TASK_EXECUTION_ID))
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(definitionId.value))
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch()
            .map { reconstructFromRecord(it) }
    }

    private fun reconstructFromRecord(record: Record): TaskExecution {
        val id = TaskExecutionId(record.get(TASK_EXECUTIONS.ID)!!)
        val taskDefinitionId = TaskDefinitionId(record.get(TASK_EXECUTIONS.TASK_DEFINITION_ID)!!)
        val scheduledDate = record.get(TASK_EXECUTIONS.SCHEDULED_DATE)!!.toDomainInstant()
        val assigneeMemberIdRaw = record.get("assignee_member_id", UUID::class.java)
        val completedByMemberIdRaw = record.get("completed_by_member_id", UUID::class.java)
        val primaryMemberIdRaw = assigneeMemberIdRaw ?: completedByMemberIdRaw
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
                assigneeMemberId = MemberId(requireNotNull(primaryMemberIdRaw)),
                taskSnapshot = reconstructSnapshot(record),
                startedAt = record.get(TASK_EXECUTIONS.STARTED_AT)!!.toDomainInstant()
            )

            "COMPLETED" -> TaskExecution.reconstructCompleted(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberId = MemberId(requireNotNull(primaryMemberIdRaw)),
                taskSnapshot = reconstructSnapshot(record),
                startedAt = record.get(TASK_EXECUTIONS.STARTED_AT)!!.toDomainInstant(),
                completedAt = record.get(TASK_EXECUTIONS.COMPLETED_AT)!!.toDomainInstant(),
                completedByMemberId = MemberId(requireNotNull(completedByMemberIdRaw ?: primaryMemberIdRaw))
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
            frozenScheduledTimeRange = ScheduledTimeRange(
                startTime = record.get(TASK_SNAPSHOTS.SCHEDULED_START_TIME)!!.toDomainInstant(),
                endTime = record.get(TASK_SNAPSHOTS.SCHEDULED_END_TIME)!!.toDomainInstant(),
            ),
            definitionVersion = record.get(TASK_SNAPSHOTS.DEFINITION_VERSION)!!,
            capturedAt = record.get(TASK_SNAPSHOTS.CREATED_AT)!!.toDomainInstant()
        )
    }

    private fun reconstructSnapshotOrNull(record: Record): TaskSnapshot? {
        val name = record.get(TASK_SNAPSHOTS.NAME) ?: return null
        return TaskSnapshot(
            frozenName = TaskDefinitionName(name),
            frozenDescription = TaskDefinitionDescription(record.get(TASK_SNAPSHOTS.DESCRIPTION) ?: ""),
            frozenScheduledTimeRange = ScheduledTimeRange(
                startTime = record.get(TASK_SNAPSHOTS.SCHEDULED_START_TIME)!!.toDomainInstant(),
                endTime = record.get(TASK_SNAPSHOTS.SCHEDULED_END_TIME)!!.toDomainInstant(),
            ),
            definitionVersion = record.get(TASK_SNAPSHOTS.DEFINITION_VERSION)!!,
            capturedAt = record.get(TASK_SNAPSHOTS.CREATED_AT)!!.toDomainInstant()
        )
    }
}
