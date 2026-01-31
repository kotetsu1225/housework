package com.task.usecase.query.member

import org.jooq.DSLContext
import java.time.LocalDate

/**
 * メンバー一覧画面向けの統計（全期間）を返す参照専用QueryService
 *
 * 定義:
 * - todayEarnedPoint: 今日獲得したポイント（earned_pointの合計）
 * - todayFamilyTaskCompletedTotal: 今日の完了済み家族タスク合計
 * - todayFamilyTaskCompleted: 今日の完了済み家族タスクのうち担当分
 * - todayPersonalTaskCompleted: 今日の完了済み個人タスク数
 */
interface MemberStatsQueryService {

    data class MemberStatsDto(
        val memberId: String,
        val todayEarnedPoint: Int,
        val todayFamilyTaskCompleted: Int,
        val todayPersonalTaskCompleted: Int
    )

    fun fetchMemberStats(session: DSLContext, targetDate: LocalDate? = null): List<MemberStatsDto>
}


