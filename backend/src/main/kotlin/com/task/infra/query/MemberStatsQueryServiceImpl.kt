package com.task.infra.query

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.usecase.query.member.MemberStatsQueryService
import org.jooq.impl.DSL
import java.util.UUID

/**
 * MemberStatsQueryService のインフラ層実装
 *
 * members 一覧に合成するため、memberId ごとの completedCount / totalCount を返す
 * - 全期間集計（scheduledDate では絞らない）
 * - CANCELLED と is_deleted=true を除外
 * - personal(owner) + participants を母集団にする
 * - 完了数は「参加しているタスクが完了」のみカウント
 */
class MemberStatsQueryServiceImpl @Inject constructor(
    private val database: Database
) : MemberStatsQueryService {

    override fun fetchMemberStats(): List<MemberStatsQueryService.MemberStatsDto> {
        return database.withSession { dsl ->
            val m = MEMBERS
            val te = TASK_EXECUTIONS
            val td = TASK_DEFINITIONS
            val tep = TASK_EXECUTION_PARTICIPANTS

            // 基本条件（母集団から除外するもの）
            val baseFilter =
                te.STATUS.ne("CANCELLED")
                    .and(td.IS_DELETED.eq(false))

            // personal(owner) で対象になる行
            val ownerRows = dsl
                .select(
                    td.OWNER_MEMBER_ID.`as`("member_id"),
                    te.ID.`as`("task_execution_id"),
                    te.STATUS.eq("COMPLETED")
                        .`as`("completed_by_member")
                )
                .from(te)
                .join(td).on(te.TASK_DEFINITION_ID.eq(td.ID))
                .where(baseFilter)
                .and(td.SCOPE.eq("PERSONAL"))
                .and(td.OWNER_MEMBER_ID.isNotNull)

            // participants で対象になる行
            val participantRows = dsl
                .select(
                    tep.MEMBER_ID.`as`("member_id"),
                    te.ID.`as`("task_execution_id"),
                    te.STATUS.eq("COMPLETED").`as`("completed_by_member")
                )
                .from(te)
                .join(td).on(te.TASK_DEFINITION_ID.eq(td.ID))
                .join(tep).on(tep.TASK_EXECUTION_ID.eq(te.ID))
                .where(baseFilter)

            // personal(owner) と participants の和集合（task_execution_id を distinct で重複排除）
            val pool = ownerRows.unionAll(participantRows).asTable("pool")
            val memberId = requireNotNull(pool.field("member_id", UUID::class.java))
            val taskExecutionId = requireNotNull(pool.field("task_execution_id", UUID::class.java))
            val completedByMember = requireNotNull(pool.field("completed_by_member", Boolean::class.java))
            val completedTaskExecutionId = DSL.case_()
                .`when`(completedByMember.eq(true), taskExecutionId)
                .otherwise(DSL.inline(null, UUID::class.java))

            val stats = dsl
                .select(
                    m.ID,
                    DSL.coalesce(DSL.countDistinct(taskExecutionId), 0).`as`("total_count"),
                    DSL.coalesce(
                        DSL.countDistinct(
                            completedTaskExecutionId
                        ),
                        0
                    ).`as`("completed_count")
                )
                .from(m)
                .leftJoin(pool).on(memberId.eq(m.ID))
                .groupBy(m.ID)
                .fetch()

            stats.map { record ->
                MemberStatsQueryService.MemberStatsDto(
                    memberId = record.get(m.ID).toString(),
                    totalCount = record.get("total_count", Int::class.java) ?: 0,
                    completedCount = record.get("completed_count", Int::class.java) ?: 0
                )
            }
        }
    }
}


