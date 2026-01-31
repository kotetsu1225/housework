package com.task.infra.query

import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_SNAPSHOTS
import com.task.usecase.query.execution.AssigneeMemberDto
import com.task.usecase.query.execution.CompletedTaskDto
import com.task.usecase.query.execution.CompletedTaskQueryService
import org.jooq.DSLContext
import org.jooq.Field
import org.jooq.impl.DSL
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * CompletedTaskQueryServiceのインフラ層実装
 *
 * jOOQを使用して完了済みタスクを効率的に取得
 * multisetパターンで担当者情報をサブクエリで取得
 */
class CompletedTaskQueryServiceImpl : CompletedTaskQueryService {

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    /**
     * 担当者情報を取得するサブクエリ用の内部データクラス
     */
    private data class AssigneeRow(
        val memberId: UUID?,
        val memberName: String?
    )

    /**
     * 担当者一覧を取得するmultisetフィールド
     *
     * TASK_EXECUTION_PARTICIPANTS と MEMBERS をJOINして
     * 担当者ID・名前のリストを取得
     */
    private fun assigneeMembersField(): Field<List<AssigneeRow>> {
        return DSL.multiset(
            DSL.select(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID, MEMBERS.NAME)
                .from(TASK_EXECUTION_PARTICIPANTS)
                .join(MEMBERS).on(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.eq(MEMBERS.ID))
                .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
                .orderBy(TASK_EXECUTION_PARTICIPANTS.JOINED_AT.asc())
        ).convertFrom { rows ->
            rows.map { row ->
                AssigneeRow(
                    memberId = row.get(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID),
                    memberName = row.get(MEMBERS.NAME)
                )
            }
        }
    }

    override fun fetch(
        session: DSLContext,
        memberIds: List<UUID>?,
        date: LocalDate?,
        limit: Int,
        offset: Int
    ): List<CompletedTaskDto> {
        val assignees = assigneeMembersField()

        // ベースクエリ: 完了済みタスクを取得
        var query = session.select(
            TASK_EXECUTIONS.ID,
            TASK_EXECUTIONS.TASK_DEFINITION_ID,
            TASK_SNAPSHOTS.NAME,
            TASK_SNAPSHOTS.DESCRIPTION,
            TASK_SNAPSHOTS.SCHEDULED_START_TIME,
            TASK_SNAPSHOTS.SCHEDULED_END_TIME,
            TASK_SNAPSHOTS.FROZEN_POINT,
            TASK_SNAPSHOTS.DEFINITION_VERSION,
            TASK_DEFINITIONS.SCOPE,
            TASK_DEFINITIONS.SCHEDULE_TYPE,
            TASK_DEFINITIONS.OWNER_MEMBER_ID,
            assignees,
            TASK_EXECUTIONS.SCHEDULED_DATE,
            TASK_EXECUTIONS.COMPLETED_AT
        )
            .from(TASK_EXECUTIONS)
            .join(TASK_DEFINITIONS).on(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(TASK_DEFINITIONS.ID))
            .join(TASK_SNAPSHOTS).on(TASK_SNAPSHOTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
            .where(TASK_EXECUTIONS.STATUS.eq("COMPLETED"))

        // memberIds フィルタ（nullable）
        // 指定されたメンバーが担当者に含まれるタスクのみ取得
        if (memberIds != null && memberIds.isNotEmpty()) {
            query = query.and(
                DSL.exists(
                    DSL.selectOne()
                        .from(TASK_EXECUTION_PARTICIPANTS)
                        .where(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
                        .and(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.`in`(memberIds))
                )
            )
        }

        // date フィルタ（nullable）
        // 指定された日付のタスクのみ取得
        if (date != null) {
            query = query.and(TASK_EXECUTIONS.SCHEDULED_DATE.eq(date))
        }

        return query
            .orderBy(TASK_EXECUTIONS.COMPLETED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch { record ->
                val assigneeRows = record.get(assignees).orEmpty()
                CompletedTaskDto(
                    taskExecutionId = record.get(TASK_EXECUTIONS.ID).toString(),
                    taskDefinitionId = record.get(TASK_EXECUTIONS.TASK_DEFINITION_ID).toString(),
                    name = record.get(TASK_SNAPSHOTS.NAME) ?: "",
                    description = record.get(TASK_SNAPSHOTS.DESCRIPTION),
                    scheduledStartTime = record.get(TASK_SNAPSHOTS.SCHEDULED_START_TIME)?.toInstant()?.toString() ?: "",
                    scheduledEndTime = record.get(TASK_SNAPSHOTS.SCHEDULED_END_TIME)?.toInstant()?.toString() ?: "",
                    frozenPoint = record.get(TASK_SNAPSHOTS.FROZEN_POINT) ?: 0,
                    definitionVersion = record.get(TASK_SNAPSHOTS.DEFINITION_VERSION) ?: 0,
                    scope = record.get(TASK_DEFINITIONS.SCOPE) ?: "FAMILY",
                    scheduleType = record.get(TASK_DEFINITIONS.SCHEDULE_TYPE) ?: "RECURRING",
                    ownerMemberId = record.get(TASK_DEFINITIONS.OWNER_MEMBER_ID)?.toString(),
                    assigneeMembers = assigneeRows.map { row ->
                        AssigneeMemberDto(
                            id = row.memberId?.toString() ?: "",
                            name = row.memberName ?: ""
                        )
                    },
                    scheduledDate = record.get(TASK_EXECUTIONS.SCHEDULED_DATE)?.format(dateFormatter) ?: "",
                    completedAt = record.get(TASK_EXECUTIONS.COMPLETED_AT)?.toInstant()?.toString() ?: ""
                )
            }
    }
}
