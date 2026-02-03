package com.task.usecase.query.notifications

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.TaskDefinition
import com.task.infra.query.TomorrowNotDailyTaskQueryServiceImpl
import org.jooq.DSLContext
import java.time.LocalDate

/**
 * 明日実行すべき非毎日タスクを、メンバーごとに取得するクエリサービス
 *
 * ロジック:
 * - FAMILY スコープのタスク → 全メンバーに割り当て
 * - PERSONAL スコープのタスク → オーナー（ownerMemberId）のみに割り当て
 *
 * @param targetDate 対象日（明日の日付を直接渡す）
 * @return 全メンバーのタスク一覧（タスク0件のメンバーも含む）
 */
@ImplementedBy(TomorrowNotDailyTaskQueryServiceImpl::class)
interface TomorrowNotDailyTaskQueryService {

    data class TaskDefinitionsForMember(
        val memberId: MemberId,
        val taskDefinitions: List<TaskDefinition>
    )

    fun fetchNotDailyTasksByMember(
        session: DSLContext,
        targetDate: LocalDate
    ): List<TaskDefinitionsForMember>
}
