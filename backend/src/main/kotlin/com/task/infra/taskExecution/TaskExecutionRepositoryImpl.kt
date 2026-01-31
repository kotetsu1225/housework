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
import com.task.infra.database.jooq.tables.TaskExecutionParticipants
import com.task.infra.database.jooq.tables.records.TaskExecutionParticipantsRecord
import com.task.infra.database.jooq.tables.records.TaskExecutionsRecord
import com.task.infra.database.jooq.tables.records.TaskSnapshotsRecord
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import org.jooq.impl.DSL.multiset
import org.jooq.impl.DSL.select
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

        taskExecution.assigneeMemberIds.let { assigneeIds ->
            insertTaskExecutionAssignee(taskExecution.id,assigneeIds , session)
        }

        return taskExecution
    }

    override fun update(taskExecution: TaskExecution, session: DSLContext): TaskExecution {
        val now = OffsetDateTime.now()

        val updateStep = session.update(TASK_EXECUTIONS)
            .set(TASK_EXECUTIONS.UPDATED_AT, now)

        when (taskExecution) {
            is TaskExecution.NotStarted -> {
                // NotStartedは基本的にcreate()で作成される
                // update()に来るのは事前割り当て変更などの例外的ケースのみ
                // STATUS は NOT_STARTED のまま（状態遷移はstart()で行う）
                updateStep
            }

            is TaskExecution.InProgress -> {
                insertSnapshot(taskExecution.id.value, taskExecution.taskSnapshot, session)
                insertTaskExecutionAssignee(taskExecution.id, taskExecution.assigneeMemberIds, session)
                updateStep
                    .set(TASK_EXECUTIONS.STATUS, "IN_PROGRESS")
                    .set(TASK_EXECUTIONS.STARTED_AT, taskExecution.startedAt.toOffsetDateTime())
            }

            is TaskExecution.Completed ->  {
                distributeProratedPoints(taskExecution, session)
                updateStep
                    .set(TASK_EXECUTIONS.STATUS, "COMPLETED")
                    .set(TASK_EXECUTIONS.COMPLETED_AT, taskExecution.completedAt.toOffsetDateTime())
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
            .set(TASK_SNAPSHOTS.FROZEN_POINT, snapshot.frozenPoint)
            .set(TASK_SNAPSHOTS.CREATED_AT, snapshot.capturedAt.toOffsetDateTime())
            .execute()
    }

    private fun distributeProratedPoints(completedTaskExecution: TaskExecution.Completed, session: DSLContext) {
        // ポイント計算はDomain層（InProgress.complete()）で実行済み
        // Repository層はその値を永続化するだけ
        val earnedPoint = completedTaskExecution.earnedPoint

        session.update(TASK_EXECUTION_PARTICIPANTS)
            .set(TASK_EXECUTION_PARTICIPANTS.EARNED_POINT, earnedPoint)
            .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(completedTaskExecution.id.value))
            .and(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.`in`(completedTaskExecution.assigneeMemberIds.map { it.value }))
            .execute()
    }

    private fun insertTaskExecutionAssignee(
        taskExecutionId: TaskExecutionId,
        assigneeMemberIds: List<MemberId>,
        session: DSLContext
    ) {
        val now = OffsetDateTime.now()
        val records = assigneeMemberIds.map { memberId ->
            session.newRecord(TASK_EXECUTION_PARTICIPANTS).apply {
                this.taskExecutionId = taskExecutionId.value
                this.memberId = memberId.value
                this.joinedAt = now
            }
        }
        session.batchInsert(records).execute()
    }

    override fun findById(id: TaskExecutionId, session: DSLContext): TaskExecution? {
        return session.select(
            TASK_EXECUTIONS.asterisk(),
            snapshotField,
            participantsField
        )
            .from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.ID.eq(id.value))
            .fetchOne { record ->
                reconstructFromRecord(
                    record.into(TaskExecutionsRecord::class.java),
                    record.get(snapshotField),
                    record.get(participantsField)
                )
            }

    }

    override fun findAll(session: DSLContext, limit: Int, offset: Int): List<TaskExecution> {
        return session.select(
            TASK_EXECUTIONS.asterisk(),
            snapshotField,
            participantsField
        )
            .from(TASK_EXECUTIONS)
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch { record ->
                reconstructFromRecord(
                    record.into(TaskExecutionsRecord::class.java),
                    record.get(snapshotField),
                    record.get(participantsField)
                )
            }
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

        return session.select(
            TASK_EXECUTIONS.asterisk(),
            snapshotField,
            participantsField
        )
            .from(TASK_EXECUTIONS)
            .where(condition)
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch { record ->
                reconstructFromRecord(
                    record.into(TaskExecutionsRecord::class.java),
                    record.get(snapshotField),
                    record.get(participantsField)
                )
            }
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

        filter.assigneeMemberIds?.let { memberIds ->
            val idValues = memberIds.map { it.value }
            val participantsExists = DSL.exists(
                DSL.selectOne()
                .from(TASK_EXECUTION_PARTICIPANTS)
                    .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
                    .and(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.`in`(idValues))
            )
            condition = condition.and(participantsExists)
        }

        return condition
    }

    override fun findByScheduledDate(scheduledDate: LocalDate, session: DSLContext): List<TaskExecution> {
        return session.select(
            TASK_EXECUTIONS.asterisk(),
            snapshotField,
            participantsField
        )
            .from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.SCHEDULED_DATE.eq(scheduledDate))
            .orderBy(TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch { record ->
                reconstructFromRecord(
                    record.into(TaskExecutionsRecord::class.java),
                    record.get(snapshotField),
                    record.get(participantsField)
                )
            }
    }

    override fun findByAssigneeMemberIds(memberIds: List<MemberId>, session: DSLContext): List<TaskExecution> {
        val assigneeExists =
            DSL.exists(
                DSL.selectOne()
                    .from(TASK_EXECUTION_PARTICIPANTS)
                    .where(
                        TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID
                            .eq(TASK_EXECUTIONS.ID)
                    )
                    .and(
                        TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.`in`(
                            memberIds.map { it.value }
                        )
                    )
            )

        return session.select(
            TASK_EXECUTIONS.asterisk(),
            participantsField,
            snapshotField
        )
            .from(TASK_EXECUTIONS)
            .where(assigneeExists)
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch { record ->
                reconstructFromRecord(
                    record.into(TaskExecutionsRecord::class.java),
                    record.get(snapshotField),
                    record.get(participantsField)
                )
            }
    }

    private val participantsField = multiset(
        select(TASK_EXECUTION_PARTICIPANTS.asterisk())
            .from(TASK_EXECUTION_PARTICIPANTS)
            .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
        ).convertFrom { record ->
            record.into(TaskExecutionParticipantsRecord::class.java)
    }

    private val snapshotField =
        multiset(
            select(TASK_SNAPSHOTS.asterisk())
                .from(TASK_SNAPSHOTS)
                .where(TASK_SNAPSHOTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
        ).convertFrom { r ->
            r.into(TaskSnapshotsRecord::class.java).firstOrNull()
        }


    override fun findByDefinitionAndDate(
        taskDefinitionId: TaskDefinitionId,
        scheduledDate: LocalDate,
        session: DSLContext
    ): TaskExecution? {
        return session.select(
            TASK_EXECUTIONS.asterisk(),
            snapshotField,
            participantsField
        )
            .from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(taskDefinitionId.value))
            .and(TASK_EXECUTIONS.SCHEDULED_DATE.eq(scheduledDate))
            .fetchOne { record ->
                reconstructFromRecord(
                    record.into(TaskExecutionsRecord::class.java),
                    record.get(snapshotField),
                    record.get(participantsField)
                )
            }
    }

    override fun findByDefinitionId(definitionId: TaskDefinitionId, session: DSLContext): List<TaskExecution>? {
        return session.select(
            TASK_EXECUTIONS.asterisk(),
            snapshotField,
            participantsField
        )
            .from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(definitionId.value))
            .orderBy(TASK_EXECUTIONS.SCHEDULED_DATE.desc(), TASK_EXECUTIONS.CREATED_AT.desc())
            .fetch { record ->
                reconstructFromRecord(
                    record.into(TaskExecutionsRecord::class.java),
                    record.get(snapshotField),
                    record.get(participantsField)
                )
            }
    }

    override fun updateAssigneeMember(existingTaskExecution: TaskExecution, newAssigneeMemberIds:List<MemberId>, session: DSLContext): TaskExecution {
        val existAssigneeMemberIds = session.select(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID)
            .from(TASK_EXECUTION_PARTICIPANTS)
            .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(existingTaskExecution.id.value))
            .fetch(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID)
            .toSet()
        val newAssigneeMemberIds = newAssigneeMemberIds
            .map { it.value }
            .toSet()

        val deleteAssigneeMemberIds = existAssigneeMemberIds - newAssigneeMemberIds
        val insertMemberIdValues = newAssigneeMemberIds - existAssigneeMemberIds

        if (deleteAssigneeMemberIds.isNotEmpty()) {
            session.deleteFrom(TASK_EXECUTION_PARTICIPANTS)
                .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(existingTaskExecution.id.value))
                .and(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.`in`(deleteAssigneeMemberIds))
                .execute()
        }
        if (insertMemberIdValues.isNotEmpty()) {
            val insertMemberIds = existingTaskExecution.assigneeMemberIds
                .filter { it.value in insertMemberIdValues }
            insertTaskExecutionAssignee(existingTaskExecution.id, insertMemberIds, session)
        }

        val record = session.select(
            TASK_EXECUTIONS.asterisk(),
            snapshotField,
            participantsField
        )
            .from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.ID.eq(existingTaskExecution.id.value))
            .fetchOne() ?: throw IllegalStateException("TaskExecution not found")

            return reconstructFromRecord(
                record.into(TaskExecutionsRecord::class.java),
                record.get(snapshotField),
                record.get(participantsField)
            )

    }

    private fun reconstructFromRecord(
        execution: TaskExecutionsRecord,
        snapshot: TaskSnapshotsRecord?,
        participants: List<TaskExecutionParticipantsRecord>
    ): TaskExecution {
        val id = TaskExecutionId(execution.id!!)
        val taskDefinitionId = TaskDefinitionId(execution.taskDefinitionId!!)
        val scheduledDate = execution.scheduledDate!!.toDomainInstant()

        return when (execution.status) {
            "NOT_STARTED" -> TaskExecution.reconstructNotStarted(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberIds = participants.map {
                    MemberId(it.memberId!!)
                }
            )

            "IN_PROGRESS" -> TaskExecution.reconstructInProgress(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberIds = participants.map {
                    MemberId(it.memberId!!)
                }.also {
                    require(it.isNotEmpty()) { "IN_PROGRESS の担当者が存在しません。" }
                },
                taskSnapshot = reconstructSnapshot(
                    requireNotNull(snapshot) { "IN_PROGRESS のタスクスナップショットが存在しません。" }
                ),
                startedAt = execution.get(TASK_EXECUTIONS.STARTED_AT)!!.toDomainInstant()
            )

            "COMPLETED" -> TaskExecution.reconstructCompleted(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberIds = participants.map {
                    MemberId(it.memberId!!)
                }.also {
                    require(it.isNotEmpty()) { "COMPLETED の担当者が存在しません。" }
                },
                taskSnapshot = reconstructSnapshot(
                    requireNotNull(snapshot) { "COMPLETED のタスクスナップショットが存在しません。" }
                ),
                startedAt = execution.get(TASK_EXECUTIONS.STARTED_AT)!!.toDomainInstant(),
                completedAt = execution.get(TASK_EXECUTIONS.COMPLETED_AT)!!.toDomainInstant(),
                earnedPoint = participants.firstOrNull()?.earnedPoint
                    ?: throw IllegalStateException("COMPLETED の earnedPoint が存在しません。")
            )

            "CANCELLED" -> TaskExecution.reconstructCancelled(
                id = id,
                taskDefinitionId = taskDefinitionId,
                scheduledDate = scheduledDate,
                assigneeMemberIds = participants.map {
                    MemberId(it.memberId!!)
                },
                taskSnapshot = snapshot?.let { reconstructSnapshot(it) },
                startedAt = execution.get(TASK_EXECUTIONS.STARTED_AT)?.toDomainInstant(),
                cancelledAt = execution.get(TASK_EXECUTIONS.UPDATED_AT)!!.toDomainInstant()
            )

            else -> throw IllegalStateException("Unknown status: ${execution.status}")
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
            frozenPoint = record.get(TASK_SNAPSHOTS.FROZEN_POINT)!!,
            definitionVersion = record.get(TASK_SNAPSHOTS.DEFINITION_VERSION)!!,
            capturedAt = record.get(TASK_SNAPSHOTS.CREATED_AT)!!.toDomainInstant(),
        )
    }
}
