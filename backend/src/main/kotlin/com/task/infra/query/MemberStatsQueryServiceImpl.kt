package com.task.infra.query

import com.task.domain.AppTimeZone
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.usecase.query.member.MemberStatsQueryService
import org.jooq.DSLContext
import org.jooq.impl.DSL
import org.jooq.impl.DSL.`when`
import java.time.LocalDate

/**
 * MemberStatsQueryService のインフラ層実装
 *
 * members 一覧に合成するため、memberId ごとの今日集計を返す
 * - todayEarnedPoint: 今日獲得したポイント
 * - todayFamilyTaskCompletedTotal: 今日の完了済み家族タスク合計
 * - todayFamilyTaskCompleted: 今日の完了済み家族タスクのうち担当分
 * - todayPersonalTaskCompleted: 今日の完了済み個人タスク数
 */
class MemberStatsQueryServiceImpl : MemberStatsQueryService {

    override fun fetchMemberStats(
        session: DSLContext,
        targetDate: LocalDate?
    ): List<MemberStatsQueryService.MemberStatsDto> {
        val today = targetDate ?: LocalDate.now(AppTimeZone.ZONE)
        val todayStart = today.atStartOfDay(AppTimeZone.ZONE).toOffsetDateTime()
        val todayEndExclusive = today.plusDays(1).atStartOfDay(AppTimeZone.ZONE).toOffsetDateTime()
        val completedTodayCondition = TASK_EXECUTIONS.COMPLETED_AT.ge(todayStart)
            .and(TASK_EXECUTIONS.COMPLETED_AT.lt(todayEndExclusive))

        val todayEarnedPointByMember = session
            .select(
                MEMBERS.ID,
                DSL.coalesce(
                    DSL.sum(
                        DSL.`when`(
                            TASK_EXECUTIONS.ID.isNotNull,
                            TASK_EXECUTION_PARTICIPANTS.EARNED_POINT
                        ).otherwise(0)
                    ),
                    0
                ).`as`("today_earned_point")
            )
            .from(MEMBERS)
            .leftJoin(TASK_EXECUTION_PARTICIPANTS)
                .on(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.eq(MEMBERS.ID))
            .leftJoin(TASK_EXECUTIONS)
                .on(
                    TASK_EXECUTIONS.ID.eq(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID),
                    TASK_EXECUTIONS.STATUS.eq("COMPLETED"),
                    completedTodayCondition
                )
            .groupBy(MEMBERS.ID)
            .fetch()
            .associate { record ->
                record.get(MEMBERS.ID).toString() to (record.get("today_earned_point", Int::class.java) ?: 0)
            }

        val todayFamilyCompletedByMemberCount = session
            .select(
                MEMBERS.ID,
                DSL.countDistinct(
                    DSL.`when`(
                        TASK_DEFINITIONS.SCOPE.eq("FAMILY"),
                        TASK_EXECUTIONS.ID
                    )
                ).`as`("family_completed_count")
            )
            .from(MEMBERS)
            .leftJoin(TASK_EXECUTION_PARTICIPANTS)
                .on(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.eq(MEMBERS.ID))
            .leftJoin(TASK_EXECUTIONS)
                .on(
                    TASK_EXECUTIONS.ID.eq(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID),
                    TASK_EXECUTIONS.STATUS.eq("COMPLETED"),
                    completedTodayCondition
                )
            .leftJoin(TASK_DEFINITIONS)
                .on(TASK_DEFINITIONS.ID.eq(TASK_EXECUTIONS.TASK_DEFINITION_ID))
            .groupBy(MEMBERS.ID)
            .fetch()
            .associate { record ->
                record.get(MEMBERS.ID).toString() to (record.get("family_completed_count", Int::class.java) ?: 0)
            }

        val todayPersonalCompletedByMember = session
            .select(
                MEMBERS.ID,
                DSL.countDistinct(
                    DSL.`when`(
                        TASK_DEFINITIONS.SCOPE.eq("PERSONAL"),
                        TASK_EXECUTIONS.ID
                    )
                ).`as`("personal_completed_count")
            )
            .from(MEMBERS)
            .leftJoin(TASK_EXECUTION_PARTICIPANTS)
                .on(TASK_EXECUTION_PARTICIPANTS.MEMBER_ID.eq(MEMBERS.ID))
            .leftJoin(TASK_EXECUTIONS)
                .on(
                    TASK_EXECUTIONS.ID.eq(TASK_EXECUTION_PARTICIPANTS.TASK_EXECUTION_ID),
                    TASK_EXECUTIONS.STATUS.eq("COMPLETED"),
                    completedTodayCondition
                )
            .leftJoin(TASK_DEFINITIONS)
                .on(TASK_DEFINITIONS.ID.eq(TASK_EXECUTIONS.TASK_DEFINITION_ID))
            .groupBy(MEMBERS.ID)
            .fetch()
            .associate { record ->
                record.get(MEMBERS.ID).toString() to (record.get("personal_completed_count", Int::class.java) ?: 0)
            }

        return session.select(MEMBERS.ID)
            .from(MEMBERS)
            .fetch(MEMBERS.ID)
            .map { memberId ->
                val memberKey = memberId.toString()
                MemberStatsQueryService.MemberStatsDto(
                    memberId = memberKey,
                    todayEarnedPoint = todayEarnedPointByMember[memberKey] ?: 0,
                    todayFamilyTaskCompleted = todayFamilyCompletedByMemberCount[memberKey] ?: 0,
                    todayPersonalTaskCompleted = todayPersonalCompletedByMember[memberKey] ?: 0
                )
            }
    }
}
