package com.task.infra.query

import com.google.inject.Inject
import com.task.domain.AppTimeZone
import com.task.infra.database.Database
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTION_PARTICIPANTS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TASK_RECURRENCES
import com.task.infra.database.jooq.tables.references.TASK_SNAPSHOTS
import com.task.usecase.query.dashboard.*
import org.jooq.Field
import org.jooq.DSLContext
import org.jooq.impl.DSL
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

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

    private data class AssigneeRow(
        val memberId: UUID?,
        val memberName: String?
    )

    private fun assigneeMembersField(): Field<List<AssigneeRow>> {
        val tep = TASK_EXECUTION_PARTICIPANTS
        val m = MEMBERS
        return DSL.multiset(
            DSL.select(tep.MEMBER_ID, m.NAME)
                .from(tep)
                .join(m).on(tep.MEMBER_ID.eq(m.ID))
                .where(tep.TASK_EXECUTION_ID.eq(TASK_EXECUTIONS.ID))
                .orderBy(tep.JOINED_AT.asc())
        ).convertFrom { rows ->
            rows.map { row ->
                AssigneeRow(
                    memberId = row.get(tep.MEMBER_ID),
                    memberName = row.get(m.NAME)
                )
            }
        }
    }

    override fun fetchDashboardData(input: DashboardQueryService.Input): DashboardQueryService.Output {
        return database.withSession { dsl ->
            val targetDate = input.targetDate
            val today = LocalDate.now(AppTimeZone.ZONE)

            // 1. タスク一覧を取得（今日かどうかで取得方法を切り替え）
            val todayTasks = if (targetDate == today) {
                fetchTodayTasks(dsl, targetDate)
            } else {
                fetchTasksForFutureDate(dsl, targetDate)
            }

            // 2. メンバーごとのタスクサマリー
            val memberSummaries = fetchMemberSummaries(dsl, targetDate)

            DashboardQueryService.Output(
                todayTasks = todayTasks,
                memberSummaries = memberSummaries
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
        val assignees = assigneeMembersField()

        return dsl.select(
            te.ID,
            te.TASK_DEFINITION_ID,
            // スナップショットがあればそちらを優先、なければ定義から取得
            DSL.coalesce(ts.NAME, td.NAME).`as`("task_name"),
            DSL.coalesce(ts.DESCRIPTION, td.DESCRIPTION).`as`("task_description"),
            DSL.coalesce(ts.SCHEDULED_START_TIME, td.SCHEDULED_START_TIME).`as`("scheduled_start_time"),
            DSL.coalesce(ts.SCHEDULED_END_TIME, td.SCHEDULED_END_TIME).`as`("scheduled_end_time"),
            td.SCOPE,
            td.SCHEDULE_TYPE,
            te.STATUS,
            td.OWNER_MEMBER_ID,
            assignees,
            te.SCHEDULED_DATE,
            td.POINT,
            ts.FROZEN_POINT
        )
            .from(te)
            .join(td).on(te.TASK_DEFINITION_ID.eq(td.ID))
            .leftJoin(ts).on(ts.TASK_EXECUTION_ID.eq(te.ID))  // スナップショットを LEFT JOIN
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
                val assigneeRows = record.get(assignees).orEmpty()
                val assigneeIds = assigneeRows.mapNotNull { it.memberId?.toString() }
                val assigneeNames = assigneeRows.mapNotNull { it.memberName }
                TodayTaskDto(
                    taskExecutionId = record.get(te.ID).toString(),
                    taskDefinitionId = record.get(te.TASK_DEFINITION_ID).toString(),
                    taskName = record.get("task_name", String::class.java) ?: "",
                    taskDescription = record.get("task_description", String::class.java),
                    scheduledStartTime = record.get("scheduled_start_time", java.time.OffsetDateTime::class.java)?.toInstant()?.toString() ?: "",
                    scheduledEndTime = record.get("scheduled_end_time", java.time.OffsetDateTime::class.java)?.toInstant()?.toString() ?: "",
                    scope = record.get(td.SCOPE) ?: "FAMILY",
                    scheduleType = record.get(td.SCHEDULE_TYPE) ?: "RECURRING",
                    status = record.get(te.STATUS) ?: "NOT_STARTED",
                    ownerMemberId = record.get(td.OWNER_MEMBER_ID)?.toString(),
                    assigneeMemberIds = assigneeIds,
                    assigneeMemberNames = assigneeNames,
                    scheduledDate = record.get(te.SCHEDULED_DATE)?.format(dateFormatter) ?: "",
                    point = record.get(td.POINT) ?: 0,
                    frozenPoint = record.get(ts.FROZEN_POINT)
                )
            }
    }

    /**
     * 未来日（今日以外）のタスク一覧を取得
     *
     * - 既存の task_executions を取得
     * - 定期タスク定義で該当日に実行すべきもの（実行未生成）を取得
     * - 単発タスク定義で期限が該当日のもの（実行未生成）を取得
     * - マージして返す
     */
    private fun fetchTasksForFutureDate(dsl: DSLContext, targetDate: LocalDate): List<TodayTaskDto> {
        // 1. 既存の実行を取得（既に生成されているケース）
        val existingExecutions = fetchExistingExecutions(dsl, targetDate)
        val existingDefinitionIds = existingExecutions.map { it.taskDefinitionId }.toSet()

        // 2. 定期タスク定義で該当日に実行すべきもの（実行未生成）
        val scheduledRecurringTasks = fetchScheduledRecurringTasks(dsl, targetDate, existingDefinitionIds)

        // 3. 単発タスク定義で期限が該当日のもの（実行未生成）
        val scheduledOneTimeTasks = fetchScheduledOneTimeTasks(dsl, targetDate, existingDefinitionIds)

        // 4. マージして返す（既存実行 + 予定定期 + 予定単発）
        return existingExecutions + scheduledRecurringTasks + scheduledOneTimeTasks
    }

    /**
     * 指定日の既存実行を取得（fetchTodayTasksと同等）
     */
    private fun fetchExistingExecutions(dsl: DSLContext, targetDate: LocalDate): List<TodayTaskDto> {
        val te = TASK_EXECUTIONS
        val td = TASK_DEFINITIONS
        val ts = TASK_SNAPSHOTS
        val assignees = assigneeMembersField()

        return dsl.select(
            te.ID,
            te.TASK_DEFINITION_ID,
            DSL.coalesce(ts.NAME, td.NAME).`as`("task_name"),
            DSL.coalesce(ts.DESCRIPTION, td.DESCRIPTION).`as`("task_description"),
            DSL.coalesce(ts.SCHEDULED_START_TIME, td.SCHEDULED_START_TIME).`as`("scheduled_start_time"),
            DSL.coalesce(ts.SCHEDULED_END_TIME, td.SCHEDULED_END_TIME).`as`("scheduled_end_time"),
            td.SCOPE,
            td.SCHEDULE_TYPE,
            te.STATUS,
            td.OWNER_MEMBER_ID,
            assignees,
            te.SCHEDULED_DATE,
            td.POINT,
            ts.FROZEN_POINT
        )
            .from(te)
            .join(td).on(te.TASK_DEFINITION_ID.eq(td.ID))
            .leftJoin(ts).on(ts.TASK_EXECUTION_ID.eq(te.ID))
            .where(te.SCHEDULED_DATE.eq(targetDate))
            .and(td.IS_DELETED.eq(false))
            .and(te.STATUS.ne("CANCELLED"))
            .orderBy(td.NAME.asc())
            .fetch { record ->
                val assigneeRows = record.get(assignees).orEmpty()
                val assigneeIds = assigneeRows.mapNotNull { it.memberId?.toString() }
                val assigneeNames = assigneeRows.mapNotNull { it.memberName }
                TodayTaskDto(
                    taskExecutionId = record.get(te.ID).toString(),
                    taskDefinitionId = record.get(te.TASK_DEFINITION_ID).toString(),
                    taskName = record.get("task_name", String::class.java) ?: "",
                    taskDescription = record.get("task_description", String::class.java),
                    scheduledStartTime = record.get("scheduled_start_time", java.time.OffsetDateTime::class.java)?.toInstant()?.toString() ?: "",
                    scheduledEndTime = record.get("scheduled_end_time", java.time.OffsetDateTime::class.java)?.toInstant()?.toString() ?: "",
                    scope = record.get(td.SCOPE) ?: "FAMILY",
                    scheduleType = record.get(td.SCHEDULE_TYPE) ?: "RECURRING",
                    status = record.get(te.STATUS) ?: "NOT_STARTED",
                    ownerMemberId = record.get(td.OWNER_MEMBER_ID)?.toString(),
                    assigneeMemberIds = assigneeIds,
                    assigneeMemberNames = assigneeNames,
                    scheduledDate = record.get(te.SCHEDULED_DATE)?.format(dateFormatter) ?: "",
                    point = record.get(td.POINT) ?: 0,
                    frozenPoint = record.get(ts.FROZEN_POINT)
                )
            }
    }

    /**
     * 定期タスク定義で該当日に実行すべきもの（実行未生成）を取得
     *
     * 判定条件:
     * - schedule_type = 'RECURRING'
     * - start_date <= targetDate
     * - end_date IS NULL OR end_date >= targetDate
     * - パターン判定:
     *   - DAILY: daily_skip_weekends = false OR 曜日が月〜金
     *   - WEEKLY: weekly_day_of_week = targetDateの曜日
     *   - MONTHLY: monthly_day_of_month = targetDateの日
     */
    private fun fetchScheduledRecurringTasks(
        dsl: DSLContext,
        targetDate: LocalDate,
        existingDefinitionIds: Set<String>
    ): List<TodayTaskDto> {
        val td = TASK_DEFINITIONS
        val tr = TASK_RECURRENCES

        // targetDateの曜日（Java: 1=月〜7=日）
        val dayOfWeekValue = targetDate.dayOfWeek.value
        // 平日かどうか（月〜金: 1〜5）
        val isWeekday = dayOfWeekValue in 1..5
        // targetDateの日
        val dayOfMonth = targetDate.dayOfMonth

        // パターン判定条件
        val patternCondition = DSL.or(
            // DAILY: skipWeekends=false または 平日
            tr.PATTERN_TYPE.eq("DAILY").and(
                tr.DAILY_SKIP_WEEKENDS.eq(false).or(DSL.inline(isWeekday))
            ),
            // WEEKLY: 曜日が一致
            tr.PATTERN_TYPE.eq("WEEKLY").and(tr.WEEKLY_DAY_OF_WEEK.eq(dayOfWeekValue)),
            // MONTHLY: 日が一致
            tr.PATTERN_TYPE.eq("MONTHLY").and(tr.MONTHLY_DAY_OF_MONTH.eq(dayOfMonth))
        )

        return dsl.select(
            td.ID,
            td.NAME,
            td.DESCRIPTION,
            td.SCHEDULED_START_TIME,
            td.SCHEDULED_END_TIME,
            td.SCOPE,
            td.SCHEDULE_TYPE,
            td.OWNER_MEMBER_ID,
            td.POINT
        )
            .from(td)
            .join(tr).on(tr.TASK_DEFINITION_ID.eq(td.ID))
            .where(td.IS_DELETED.eq(false))
            .and(td.SCHEDULE_TYPE.eq("RECURRING"))
            .and(tr.START_DATE.le(targetDate))
            .and(tr.END_DATE.isNull.or(tr.END_DATE.ge(targetDate)))
            .and(patternCondition)
            .orderBy(td.NAME.asc())
            .fetch { record ->
                val defId = record.get(td.ID).toString()
                // 既に実行が存在するものは除外
                if (existingDefinitionIds.contains(defId)) {
                    null
                } else {
                    TodayTaskDto(
                        taskExecutionId = "scheduled-$defId",  // 仮ID（未生成）
                        taskDefinitionId = defId,
                        taskName = record.get(td.NAME) ?: "",
                        taskDescription = record.get(td.DESCRIPTION),
                        scheduledStartTime = record.get(td.SCHEDULED_START_TIME)?.toInstant()?.toString() ?: "",
                        scheduledEndTime = record.get(td.SCHEDULED_END_TIME)?.toInstant()?.toString() ?: "",
                        scope = record.get(td.SCOPE) ?: "FAMILY",
                        scheduleType = record.get(td.SCHEDULE_TYPE) ?: "RECURRING",
                        status = "SCHEDULED",  // 予定（実行未生成）
                        ownerMemberId = record.get(td.OWNER_MEMBER_ID)?.toString(),
                        assigneeMemberIds = emptyList(),
                        assigneeMemberNames = emptyList(),
                        scheduledDate = targetDate.format(dateFormatter),
                        point = record.get(td.POINT) ?: 0,
                        frozenPoint = null  // 実行未生成のためスナップショットなし
                    )
                }
            }.filterNotNull()
    }

    /**
     * 単発タスク定義で期限が該当日のもの（実行未生成）を取得
     */
    private fun fetchScheduledOneTimeTasks(
        dsl: DSLContext,
        targetDate: LocalDate,
        existingDefinitionIds: Set<String>
    ): List<TodayTaskDto> {
        val td = TASK_DEFINITIONS

        return dsl.select(
            td.ID,
            td.NAME,
            td.DESCRIPTION,
            td.SCHEDULED_START_TIME,
            td.SCHEDULED_END_TIME,
            td.SCOPE,
            td.SCHEDULE_TYPE,
            td.OWNER_MEMBER_ID,
            td.POINT
        )
            .from(td)
            .where(td.IS_DELETED.eq(false))
            .and(td.SCHEDULE_TYPE.eq("ONE_TIME"))
            .and(td.ONE_TIME_DEADLINE.eq(targetDate))
            .orderBy(td.NAME.asc())
            .fetch { record ->
                val defId = record.get(td.ID).toString()
                // 既に実行が存在するものは除外
                if (existingDefinitionIds.contains(defId)) {
                    null
                } else {
                    TodayTaskDto(
                        taskExecutionId = "scheduled-$defId",  // 仮ID（未生成）
                        taskDefinitionId = defId,
                        taskName = record.get(td.NAME) ?: "",
                        taskDescription = record.get(td.DESCRIPTION),
                        scheduledStartTime = record.get(td.SCHEDULED_START_TIME)?.toInstant()?.toString() ?: "",
                        scheduledEndTime = record.get(td.SCHEDULED_END_TIME)?.toInstant()?.toString() ?: "",
                        scope = record.get(td.SCOPE) ?: "FAMILY",
                        scheduleType = record.get(td.SCHEDULE_TYPE) ?: "ONE_TIME",
                        status = "SCHEDULED",  // 予定（実行未生成）
                        ownerMemberId = record.get(td.OWNER_MEMBER_ID)?.toString(),
                        assigneeMemberIds = emptyList(),
                        assigneeMemberNames = emptyList(),
                        scheduledDate = targetDate.format(dateFormatter),
                        point = record.get(td.POINT) ?: 0,
                        frozenPoint = null  // 実行未生成のためスナップショットなし
                    )
                }
            }.filterNotNull()
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
        val tep = TASK_EXECUTION_PARTICIPANTS

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
            val memberParticipates = DSL.exists(
                DSL.selectOne()
                    .from(tep)
                    .where(tep.TASK_EXECUTION_ID.eq(te.ID))
                    .and(tep.MEMBER_ID.eq(memberId))
            )
            val noParticipants = DSL.notExists(
                DSL.selectOne()
                    .from(tep)
                    .where(tep.TASK_EXECUTION_ID.eq(te.ID))
            )
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
                    // 参加者がこのメンバー、または参加者なしの家族タスク
                    memberParticipates
                        .or(noParticipants.and(td.SCOPE.eq("FAMILY")))
                        .or(td.SCOPE.eq("PERSONAL").and(td.OWNER_MEMBER_ID.eq(memberId)))
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
}
