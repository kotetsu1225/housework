package com.task.usecase.query.member

/**
 * メンバー一覧画面向けの統計（全期間）を返す参照専用QueryService
 *
 * 定義:
 * - totalCount: personal(owner) + assignee の母集団（CANCELLED除外、is_deleted除外）
 * - completedCount: 上記母集団のうち、status=COMPLETED かつ completedBy=本人
 */
interface MemberStatsQueryService {

    data class MemberStatsDto(
        val memberId: String,
        val completedCount: Int,
        val totalCount: Int
    )

    fun fetchMemberStats(): List<MemberStatsDto>
}


