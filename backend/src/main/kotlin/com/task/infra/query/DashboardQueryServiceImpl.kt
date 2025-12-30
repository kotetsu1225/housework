package com.task.infra.query

import com.google.inject.Inject
import com.task.infra.database.Database
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.MEMBER_AVAILABILITIES
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_SNAPSHOTS
import com.task.infra.database.jooq.tables.references.TIME_SLOTS
import com.task.usecase.query.dashboard.*
import org.jooq.DSLContext
import org.jooq.impl.DSL
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * DashboardQueryServiceのインフラ層実装
 *
 * CQRSパターン: 複数集約をJOINして取得する参照専用サービス
 * jOOQを使用して最適化されたクエリを実行
 */
class DashboardQueryServiceImpl @Inject constructor(
    private val database: Database
) : DashboardQueryService {

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")

    override fun fetchDashboardData(input: DashboardQueryService.Input): DashboardQueryService.Output {
        return database.withSession { dsl ->
            val targetDate = input.targetDate

            // 1. 今日のタスク一覧（TaskExecution + TaskDefinition + Member JOIN）
            val todayTasks = fetchTodayTasks(dsl, targetDate)

            // 2. メンバーごとのタスクサマリー
            val memberSummaries = fetchMemberSummaries(dsl, targetDate)

            // 3. メンバーの本日の空き時間
            val memberAvailabilities = fetchMemberAvailabilities(dsl, targetDate)

            DashboardQueryService.Output(
                todayTasks = todayTasks,
                memberSummaries = memberSummaries,
                memberAvailabilities = memberAvailabilities
            )
        }
    }

    /**
     * 今日のタスク一覧を取得
     *
     * TaskExecution + TaskDefinition + TaskSnapshot + Member をJOINして取得
     * IN_PROGRESS以上の状態ではスナップショットの情報を優先
     * パフォーマンス最適化: 必要なカラムのみSELECT
     */
    private fun fetchTodayTasks(dsl: DSLContext, targetDate: LocalDate): List<TodayTaskDto> {
        val te = TASK_EXECUTIONS
        val td = TASK_DEFINITIONS
        val ts = TASK_SNAPSHOTS
        val m = MEMBERS.`as`("assignee")

        return dsl.select(
            te.ID,
            te.TASK_DEFINITION_ID,
            // スナップショットがあればそちらを優先、なければ定義から取得
            DSL.coalesce(ts.NAME, td.NAME).`as`("task_name"),
            DSL.coalesce(ts.DESCRIPTION, td.DESCRIPTION).`as`("task_description"),
            DSL.coalesce(ts.SCHEDULED_START_TIME, td.SCHEDULED_START_TIME).`as`("scheduled_start_time"),
            DSL.coalesce(ts.SCHEDULED_END_TIME, td.SCHEDULED_END_TIME).`as`("scheduled_end_time"),
            td.SCOPE,
            te.STATUS,
            te.ASSIGNEE_MEMBER_ID,
            m.NAME.`as`("assignee_name"),
            te.SCHEDULED_DATE
        )
            .from(te)
            .join(td).on(te.TASK_DEFINITION_ID.eq(td.ID))
            .leftJoin(ts).on(ts.TASK_EXECUTION_ID.eq(te.ID))  // スナップショットを LEFT JOIN
            .leftJoin(m).on(te.ASSIGNEE_MEMBER_ID.eq(m.ID))
            .where(te.SCHEDULED_DATE.eq(targetDate))
            .and(td.IS_DELETED.eq(false))
            .and(te.STATUS.ne("CANCELLED"))
            .orderBy(
                DSL.case_()
                    .`when`(te.STATUS.eq("IN_PROGRESS"), 1)
                    .`when`(te.STATUS.eq("NOT_STARTED"), 2)
                    .`when`(te.STATUS.eq("COMPLETED"), 3)
                    .otherwise(4),
                td.NAME.asc()
            )
            .fetch { record ->
                TodayTaskDto(
                    taskExecutionId = record.get(te.ID).toString(),
                    taskDefinitionId = record.get(te.TASK_DEFINITION_ID).toString(),
                    taskName = record.get("task_name", String::class.java) ?: "",
                    taskDescription = record.get("task_description", String::class.java),
                    scheduledStartTime = record.get("scheduled_start_time", java.time.OffsetDateTime::class.java)?.toInstant()?.toString() ?: "",
                    scheduledEndTime = record.get("scheduled_end_time", java.time.OffsetDateTime::class.java)?.toInstant()?.toString() ?: "",
                    scope = record.get(td.SCOPE) ?: "FAMILY",
                    status = record.get(te.STATUS) ?: "NOT_STARTED",
                    assigneeMemberId = record.get(te.ASSIGNEE_MEMBER_ID)?.toString(),
                    assigneeMemberName = record.get("assignee_name", String::class.java),
                    scheduledDate = record.get(te.SCHEDULED_DATE)?.format(dateFormatter) ?: ""
                )
            }
    }

    /**
     * メンバーごとのタスクサマリーを取得
     *
     * 全メンバーを取得し、それぞれのタスク状況を集計
     */
    private fun fetchMemberSummaries(dsl: DSLContext, targetDate: LocalDate): List<MemberTaskSummaryDto> {
        val m = MEMBERS
        val te = TASK_EXECUTIONS
        val td = TASK_DEFINITIONS

        // 全メンバーを取得
        val members = dsl.select(m.ID, m.NAME, m.ROLE)
            .from(m)
            .orderBy(m.NAME)
            .fetch()

        return members.map { memberRecord ->
            val memberId = memberRecord.get(m.ID)!!
            val memberName = memberRecord.get(m.NAME) ?: ""
            val familyRole = memberRecord.get(m.ROLE) ?: ""

            // そのメンバーの今日のタスク一覧
            val memberTasks = dsl.select(
                te.ID,
                td.NAME,
                te.STATUS
            )
                .from(te)
                .join(td).on(te.TASK_DEFINITION_ID.eq(td.ID))
                .where(te.SCHEDULED_DATE.eq(targetDate))
                .and(td.IS_DELETED.eq(false))
                .and(te.STATUS.ne("CANCELLED"))
                .and(
                    // 担当者がこのメンバー、または未割り当ての家族タスク
                    te.ASSIGNEE_MEMBER_ID.eq(memberId)
                        .or(
                            te.ASSIGNEE_MEMBER_ID.isNull
                                .and(td.SCOPE.eq("FAMILY"))
                        )
                        .or(
                            // 個人タスクでオーナーがこのメンバー
                            td.SCOPE.eq("PERSONAL")
                                .and(td.OWNER_MEMBER_ID.eq(memberId))
                        )
                )
                .fetch { record ->
                    MemberTaskDto(
                        taskExecutionId = record.get(te.ID).toString(),
                        taskName = record.get(td.NAME) ?: "",
                        status = record.get(te.STATUS) ?: "NOT_STARTED"
                    )
                }

            val completedCount = memberTasks.count { it.status == "COMPLETED" }
            val totalCount = memberTasks.size

            MemberTaskSummaryDto(
                memberId = memberId.toString(),
                memberName = memberName,
                familyRole = familyRole,
                completedCount = completedCount,
                totalCount = totalCount,
                tasks = memberTasks
            )
        }
    }

    /**
     * メンバーの本日の空き時間を取得
     *
     * MemberAvailability + TimeSlots + Member をJOINして取得
     */
    private fun fetchMemberAvailabilities(dsl: DSLContext, targetDate: LocalDate): List<MemberAvailabilityTodayDto> {
        val ma = MEMBER_AVAILABILITIES
        val ts = TIME_SLOTS
        val m = MEMBERS

        // まず該当日の空き時間を持つメンバーを取得
        val availabilityData = dsl.select(
            m.ID,
            m.NAME,
            m.ROLE,
            ts.START_TIME,
            ts.END_TIME,
            ts.MEMO
        )
            .from(ma)
            .join(m).on(ma.MEMBER_ID.eq(m.ID))
            .join(ts).on(ts.MEMBER_AVAILABILITY_ID.eq(ma.ID))
            .where(ma.TARGET_DATE.eq(targetDate))
            .orderBy(m.NAME, ts.START_TIME)
            .fetch()

        // メンバーごとにグループ化
        return availabilityData.groupBy { record ->
            Triple(
                record.get(m.ID).toString(),
                record.get(m.NAME) ?: "",
                record.get(m.ROLE) ?: ""
            )
        }.map { (memberInfo, records) ->
            val (memberId, memberName, familyRole) = memberInfo
            val slots = records.map { record ->
                TimeSlotDto(
                    startTime = record.get(ts.START_TIME)?.format(timeFormatter) ?: "",
                    endTime = record.get(ts.END_TIME)?.format(timeFormatter) ?: "",
                    memo = record.get(ts.MEMO)
                )
            }
            MemberAvailabilityTodayDto(
                memberId = memberId,
                memberName = memberName,
                familyRole = familyRole,
                slots = slots
            )
        }
    }
}

